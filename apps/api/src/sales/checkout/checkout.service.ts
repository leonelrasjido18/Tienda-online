import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculatePaymentPlan,
  formatOrderNumber,
  type CartCustomizationDraft,
  type CreateOrderInput,
  type CreateOrderResponse,
  type PaymentPlanLineItem,
  type ResolvedFulfillment,
} from '@tienda/shared';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';

import { RenderService } from '../../catalog/customization/render.service';
import { UploadsService } from '../../catalog/uploads/uploads.service';
import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { PushService } from '../notifications/push.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { SettingsService } from '../settings/settings.service';
import { STOCK_RESERVATION_QUEUE, type StockReservationJobData } from '../stock/reservation-queue.constants';
import { StockReservationService } from '../stock/stock-reservation.service';

const CART_ITEM_INCLUDE = {
  variant: {
    include: {
      product: {
        include: {
          images: { orderBy: { position: 'asc' as const }, take: 1 },
          customization: { include: { patchOptions: { include: { patch: true } } } },
        },
      },
      inventory: true,
      optionValues: { include: { value: true } },
    },
  },
} satisfies Prisma.CartItemInclude;

type CartItemWithRelations = Prisma.CartItemGetPayload<{ include: typeof CART_ITEM_INCLUDE }>;

interface PreparedLine {
  item: CartItemWithRelations;
  extraCents: number;
  totalCents: number;
  productionImageUrl: string | null;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly stock: StockReservationService,
    private readonly render: RenderService,
    private readonly uploads: UploadsService,
    private readonly payments: PaymentProviderRegistry,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly config: ConfigService<Env, true>,
    @InjectQueue(STOCK_RESERVATION_QUEUE) private readonly reservationQueue: Queue<StockReservationJobData>,
  ) {}

  async createOrder(cartId: string, input: CreateOrderInput): Promise<CreateOrderResponse> {
    const rawItems = await this.prisma.cartItem.findMany({
      where: { cartId },
      include: CART_ITEM_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });

    if (rawItems.length === 0) {
      throw new BadRequestException('El carrito está vacío');
    }

    const storeSettings = await this.settings.get();
    const preparedLines = await this.prepareLines(rawItems);

    const order = await this.prisma.$transaction(async (tx) => {
      const variantIds = rawItems.map((i) => i.variantId);
      const locked = await this.stock.lockInventory(tx, variantIds);

      const resolutions = preparedLines.map((line) => {
        const product = line.item.variant.product;
        const inv = locked.get(line.item.variantId);
        const available = Math.max(0, (inv?.quantity ?? 0) - (inv?.reserved ?? 0));
        const allowPreorder = line.item.variant.inventory?.allowPreorder ?? false;

        let resolved: ResolvedFulfillment;
        if (product.fulfillmentMode === 'PREORDER') {
          resolved = 'PREORDER';
        } else if (product.fulfillmentMode === 'IN_STOCK') {
          if (available < line.item.quantity) {
            throw new ConflictException(`No hay stock suficiente de ${product.name}`);
          }
          resolved = 'IN_STOCK';
        } else if (available >= line.item.quantity) {
          resolved = 'IN_STOCK';
        } else if (allowPreorder) {
          resolved = 'PREORDER';
        } else {
          throw new ConflictException(`No hay stock suficiente de ${product.name}`);
        }

        return { line, resolved };
      });

      await this.stock.reserve(
        tx,
        resolutions
          .filter((r) => r.resolved === 'IN_STOCK')
          .map((r) => ({ variantId: r.line.item.variantId, quantity: r.line.item.quantity })),
      );

      const planLines: PaymentPlanLineItem[] = resolutions.map(({ line, resolved }) => ({
        totalCents: line.totalCents,
        fulfillment: resolved,
      }));
      const plan = calculatePaymentPlan(planLines, storeSettings.defaultDepositPercent);

      // La transferencia da más tiempo: el cliente tiene que ir al banco.
      const reservationMinutes =
        input.paymentMethod === 'bank_transfer'
          ? this.config.get('BANK_TRANSFER_RESERVATION_TTL_HOURS') * 60
          : this.config.get('CHECKOUT_RESERVATION_TTL_MINUTES');
      const expiresAt = new Date(Date.now() + reservationMinutes * 60_000);

      const shippingFields =
        input.shipping.method === 'delivery'
          ? {
              pickupInStore: false,
              shippingStreet: input.shipping.street,
              shippingNumber: input.shipping.number ?? null,
              shippingFloor: input.shipping.floor ?? null,
              shippingCity: input.shipping.city,
              shippingProvince: input.shipping.province,
              shippingPostalCode: input.shipping.postalCode,
              shippingNotes: input.shipping.notes ?? null,
            }
          : { pickupInStore: true };

      const created = await tx.order.create({
        data: {
          contactName: input.contact.name,
          contactEmail: input.contact.email,
          contactPhone: input.contact.phone ?? null,
          ...shippingFields,
          paymentPlan: plan.plan,
          subtotalCents: plan.subtotalCents,
          depositCents: plan.depositCents,
          balanceCents: plan.balanceCents,
          totalCents: plan.subtotalCents,
          notes: input.notes ?? null,
          expiresAt,
          items: {
            create: resolutions.map(({ line, resolved }) => ({
              variantId: line.item.variantId,
              productName: line.item.variant.product.name,
              variantSku: line.item.variant.sku,
              optionsLabel: this.optionsLabel(line.item) || null,
              imageUrl: line.productionImageUrl ?? line.item.variant.product.images[0]?.url ?? null,
              unitPriceCents: line.item.priceCentsAtAdd,
              quantity: line.item.quantity,
              totalCents: line.totalCents,
              fulfillmentMode: resolved,
              customization: this.draftOf(line.item)
                ? {
                    create: {
                      playerName: this.draftOf(line.item)?.playerName ?? null,
                      playerNumber: this.draftOf(line.item)?.playerNumber ?? null,
                      fontId: this.draftOf(line.item)?.fontId ?? null,
                      patchIds: this.draftOf(line.item)?.patchIds ?? [],
                      extraCents: line.extraCents,
                      previewImageUrl: line.productionImageUrl,
                      productionImageUrl: line.productionImageUrl,
                    },
                  }
                : undefined,
            })),
          },
          events: { create: { type: 'created', message: 'Pedido creado' } },
          payments: {
            create: {
              kind: plan.plan === 'FULL' ? 'FULL' : 'DEPOSIT',
              provider: input.paymentMethod,
              amountCents: plan.dueTodayCents,
            },
          },
        },
        include: { payments: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId } });

      return created;
    });

    await this.reservationQueue.add(
      'expire',
      { orderId: order.id },
      { delay: order.expiresAt ? order.expiresAt.getTime() - Date.now() : undefined, jobId: order.id },
    );

    const payment = order.payments[0];
    if (!payment) {
      throw new BadRequestException('No se pudo crear el pago del pedido');
    }
    let redirectUrl: string | null = null;

    if (input.paymentMethod !== 'bank_transfer') {
      const provider = this.payments.active();
      const checkout = await provider.createCheckout({
        paymentId: payment.id,
        orderId: order.id,
        orderNumber: order.number,
        kindLabel: payment.kind === 'FULL' ? 'Pago total' : 'Seña',
        amountCents: payment.amountCents,
      });
      redirectUrl = checkout.redirectUrl;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { provider: provider.name, rawPayload: { providerRef: checkout.providerRef } },
      });
    }

    const mailContext = {
      number: order.number,
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      totalCents: order.totalCents,
      dueTodayCents: payment.amountCents,
      paymentPlan: order.paymentPlan,
    };
    await this.mail.sendOrderConfirmation(mailContext);
    await this.mail.sendSaleAlert(mailContext, 'Nuevo pedido');
    await this.push.broadcast({
      title: `Nuevo pedido ${formatOrderNumber(order.number)}`,
      body: `${order.contactName} — ${payment.kind === 'FULL' ? 'pago total' : 'seña'} pendiente`,
      url: `/pedidos/${order.id}`,
    });

    return {
      orderId: order.id,
      displayNumber: formatOrderNumber(order.number),
      paymentMethod: input.paymentMethod,
      redirectUrl,
      bankTransferInstructions: input.paymentMethod === 'bank_transfer' ? storeSettings.bankTransferInstructions : null,
      dueTodayCents: payment.amountCents,
    };
  }

  private async prepareLines(items: CartItemWithRelations[]): Promise<PreparedLine[]> {
    const results: PreparedLine[] = [];
    for (const item of items) {
      const draft = this.draftOf(item);
      const extraCents = this.computeExtraCents(draft, item.variant.product.customization);
      const totalCents = (item.priceCentsAtAdd + extraCents) * item.quantity;

      if (!draft) {
        results.push({ item, extraCents, totalCents, productionImageUrl: null });
        continue;
      }

      const buffer = await this.render.renderProductCustomization(item.variant.product.id, {
        playerName: draft.playerName,
        playerNumber: draft.playerNumber,
        patchIds: draft.patchIds ?? [],
      });
      const stored = await this.uploads.storeGeneratedPng(buffer, 'orders');
      results.push({ item, extraCents, totalCents, productionImageUrl: stored.url });
    }
    return results;
  }

  private draftOf(item: CartItemWithRelations): CartCustomizationDraft | null {
    const draft = item.customizationDraft as CartCustomizationDraft | null;
    if (!draft) return null;
    const hasContent = !!draft.playerName || draft.playerNumber !== undefined || (draft.patchIds ?? []).length > 0;
    return hasContent ? draft : null;
  }

  private computeExtraCents(
    draft: CartCustomizationDraft | null,
    template: CartItemWithRelations['variant']['product']['customization'],
  ): number {
    if (!draft || !template) return 0;
    let extra = 0;
    if (draft.playerName) extra += template.nameExtraCents;
    if (draft.playerNumber !== undefined) extra += template.numberExtraCents;
    for (const patchId of draft.patchIds ?? []) {
      const option = template.patchOptions.find((po) => po.patchId === patchId);
      if (option) extra += option.patch.priceCents;
    }
    return extra;
  }

  private optionsLabel(item: CartItemWithRelations): string {
    return item.variant.optionValues.map((ov) => ov.value.value).join(' / ');
  }
}
