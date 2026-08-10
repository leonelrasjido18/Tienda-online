import { randomBytes } from 'node:crypto';

import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  formatCentsAsArs,
  formatOrderNumber,
  type BalanceCheckoutDto,
  type CheckoutPaymentMethod,
  type PayBalanceResponse,
} from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import type { Env } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../sales/notifications/mail.service';
import { PushService } from '../sales/notifications/push.service';
import { PaymentProviderRegistry } from '../sales/payments/payment-provider.registry';
import { ShippingService } from '../shipping/shipping.service';

const LINK_INCLUDE = {
  order: {
    include: {
      items: { include: { customization: true } },
    },
  },
} satisfies Prisma.PaymentLinkInclude;

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shipping: ShippingService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly payments: PaymentProviderRegistry,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Se dispara al marcar el lote como RECIBIDO: por cada pedido cotiza el envío,
   * congela el monto en un link de cobro y le avisa al cliente por email.
   *
   * Es idempotente: un pedido que ya tiene link pendiente no genera otro, así que
   * volver a marcar RECIBIDO (o reintentar tras un fallo) no duplica cobros.
   */
  async onBatchReceived(batchId: string) {
    const orders = await this.prisma.order.findMany({
      where: { importBatchId: batchId, financialStatus: { in: ['DEPOSIT_PAID', 'AWAITING_BALANCE'] } },
    });

    const ttlDays = this.config.get('BALANCE_LINK_TTL_DAYS');
    let generated = 0;

    for (const order of orders) {
      const existing = await this.prisma.paymentLink.findFirst({
        where: { orderId: order.id, status: 'PENDING' },
      });
      if (existing) continue;

      const quote = await this.shipping.quoteForOrder(order.id);
      const balanceCents = order.balanceCents ?? 0;
      const amountCents = balanceCents + quote.priceCents;

      const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
      const token = randomBytes(24).toString('base64url');

      await this.prisma.$transaction(async (tx) => {
        await tx.paymentLink.create({
          data: {
            token,
            orderId: order.id,
            balanceCents,
            shippingCents: quote.priceCents,
            amountCents,
            expiresAt,
          },
        });

        await tx.order.update({
          where: { id: order.id },
          data: {
            shippingCents: quote.priceCents,
            totalCents: order.subtotalCents + quote.priceCents,
            financialStatus: 'AWAITING_BALANCE',
            fulfillmentStatus: 'READY',
          },
        });

        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            type: 'balance_requested',
            message: `Saldo solicitado: ${formatCentsAsArs(amountCents)} (envío ${formatCentsAsArs(quote.priceCents)}${
              quote.fallbackReason ? ` — ${quote.fallbackReason}` : ''
            })`,
          },
        });
      });

      await this.mail.sendBalanceRequest({
        contactName: order.contactName,
        contactEmail: order.contactEmail,
        displayNumber: formatOrderNumber(order.number),
        balanceCents,
        shippingCents: quote.priceCents,
        amountCents,
        url: this.publicUrl(token),
        expiresAt,
      });

      generated += 1;
    }

    if (generated > 0) {
      await this.push.broadcast({
        title: 'Lote recibido',
        body: `Se enviaron ${generated} pedido(s) de cobro de saldo`,
        url: '/dashboard/lotes',
      });
    }

    this.logger.log(`Lote ${batchId}: ${generated} link(s) de saldo generados`);
    return { generated };
  }

  /** Vista pública del link, por token. */
  async getByToken(token: string): Promise<BalanceCheckoutDto> {
    const link = await this.prisma.paymentLink.findUnique({ where: { token }, include: LINK_INCLUDE });
    if (!link) {
      throw new NotFoundException('El link de pago no existe');
    }

    // Se marca vencido al leerlo en vez de depender sólo del job, para que el
    // cliente vea el estado real aunque el worker esté caído.
    const status =
      link.status === 'PENDING' && link.expiresAt < new Date() ? ('EXPIRED' as const) : link.status;

    const order = link.order;
    const address = order.pickupInStore
      ? null
      : [
          [order.shippingStreet, order.shippingNumber].filter(Boolean).join(' '),
          order.shippingFloor,
          order.shippingCity,
          order.shippingProvince,
          order.shippingPostalCode,
        ]
          .filter(Boolean)
          .join(', ');

    return {
      token: link.token,
      status,
      expiresAt: link.expiresAt.toISOString(),
      orderDisplayNumber: formatOrderNumber(order.number),
      contactName: order.contactName,
      balanceCents: link.balanceCents,
      shippingCents: link.shippingCents,
      amountCents: link.amountCents,
      pickupInStore: order.pickupInStore,
      shippingAddress: address,
      items: order.items.map((item) => ({
        productName: item.productName,
        optionsLabel: item.optionsLabel,
        imageUrl: item.imageUrl,
        quantity: item.quantity,
        playerName: item.customization?.playerName ?? null,
        playerNumber: item.customization?.playerNumber ?? null,
      })),
    };
  }

  /** Arranca el pago del saldo con la pasarela activa (o transferencia). */
  async startPayment(token: string, method: CheckoutPaymentMethod): Promise<PayBalanceResponse> {
    const link = await this.prisma.paymentLink.findUnique({ where: { token }, include: { order: true } });
    if (!link) {
      throw new NotFoundException('El link de pago no existe');
    }
    if (link.status === 'PAID') {
      throw new BadRequestException('Este saldo ya fue pagado');
    }
    if (link.status !== 'PENDING' || link.expiresAt < new Date()) {
      throw new BadRequestException('El link de pago venció. Escribinos para generar uno nuevo.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: link.orderId,
        kind: 'BALANCE',
        provider: method,
        amountCents: link.amountCents,
      },
    });

    if (method === 'bank_transfer') {
      const settings = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
      return {
        redirectUrl: null,
        bankTransferInstructions: settings?.bankTransferInstructions ?? null,
        amountCents: link.amountCents,
      };
    }

    const provider = this.payments.active();
    const checkout = await provider.createCheckout({
      paymentId: payment.id,
      orderId: link.orderId,
      orderNumber: link.order.number,
      kindLabel: 'Saldo + envío',
      amountCents: link.amountCents,
    });

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { provider: provider.name, rawPayload: { providerRef: checkout.providerRef } },
      }),
      this.prisma.paymentLink.update({
        where: { id: link.id },
        data: { providerPreferenceId: checkout.providerRef },
      }),
    ]);

    return { redirectUrl: checkout.redirectUrl, bankTransferInstructions: null, amountCents: link.amountCents };
  }

  /**
   * Cierra el saldo de un pedido. Lo llaman tanto el webhook de Mercado Pago como
   * la marca manual del panel, así que vive en un solo lugar.
   */
  async settleBalance(orderId: string, reason: string) {
    const order = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { financialStatus: 'PAID' },
      });

      await tx.paymentLink.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'PAID', paidAt: new Date() },
      });

      await tx.orderEvent.create({
        data: { orderId, type: 'balance_paid', message: reason },
      });

      return updated;
    });

    await this.push.broadcast({
      title: `Saldo cobrado ${formatOrderNumber(order.number)}`,
      body: `${order.contactName} — ${formatCentsAsArs(order.totalCents)}`,
      url: `/dashboard/pedidos/${order.id}`,
    });

    return order;
  }

  /** Marca manual desde el panel, para transferencias recibidas por fuera. */
  async markPaidManually(orderId: string, note?: string | null) {
    const link = await this.prisma.paymentLink.findFirst({ where: { orderId, status: 'PENDING' } });
    if (!link) {
      throw new BadRequestException('Este pedido no tiene un saldo pendiente');
    }

    await this.prisma.payment.create({
      data: {
        orderId,
        kind: 'BALANCE',
        provider: 'manual',
        amountCents: link.amountCents,
        status: 'APPROVED',
      },
    });

    return this.settleBalance(orderId, note?.trim() || 'Saldo marcado como cobrado desde el panel');
  }

  private publicUrl(token: string): string {
    return `${this.config.get('STOREFRONT_URL')}/saldo/${token}`;
  }
}
