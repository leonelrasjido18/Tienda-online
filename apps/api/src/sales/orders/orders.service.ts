import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  formatOrderNumber,
  type OrderDetailDto,
  type OrderFinancialStatus,
  type OrderSummaryDto,
  type PaymentStatus as PaymentStatusValue,
} from '@tienda/shared';
import type { Order, OrderEvent, OrderItem, OrderItemCustomization, Payment, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { PushService } from '../notifications/push.service';
import { StockReservationService } from '../stock/stock-reservation.service';

const ORDER_DETAIL_INCLUDE = {
  items: { include: { customization: true } },
  events: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Order & {
  items: (OrderItem & { customization: OrderItemCustomization | null })[];
  events: OrderEvent[];
  payments: Payment[];
};

export interface AdminOrderListQuery {
  financialStatus?: OrderFinancialStatus;
  q?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockReservationService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  async list(query: AdminOrderListQuery): Promise<{ items: OrderSummaryDto[]; total: number }> {
    const where: Prisma.OrderWhereInput = {
      ...(query.financialStatus ? { financialStatus: query.financialStatus } : {}),
      ...(query.q
        ? {
            OR: [
              { contactName: { contains: query.q, mode: 'insensitive' } },
              { contactEmail: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items: rows.map((order) => this.toSummaryDto(order)), total };
  }

  async detail(orderId: string): Promise<OrderDetailDto> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }
    return this.toDetailDto(order);
  }

  /** Aprobación manual de una transferencia bancaria desde el panel. */
  async approveBankTransfer(orderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.orderId !== orderId) {
      throw new NotFoundException('El pago no existe para este pedido');
    }
    if (payment.provider !== 'bank_transfer') {
      throw new BadRequestException('Este pago no es una transferencia bancaria');
    }
    if (payment.status === 'APPROVED') {
      return this.detail(orderId);
    }

    await this.applyApprovedPayment(payment.id, { provider: 'bank_transfer' });
    return this.detail(orderId);
  }

  /**
   * Aplica el resultado ya verificado de un pago, venga de la pasarela que venga.
   * El estado llega normalizado por el PaymentProvider correspondiente.
   */
  async applyPaymentStatus(
    paymentId: string,
    result: { provider: string; status: PaymentStatusValue; providerPaymentId: string; rawPayload: unknown },
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;

    if (result.status === 'APPROVED' && payment.status !== 'APPROVED') {
      await this.applyApprovedPayment(payment.id, {
        provider: result.provider,
        providerPaymentId: result.providerPaymentId,
        rawPayload: result.rawPayload,
      });
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: result.status,
        providerPaymentId: result.providerPaymentId,
        rawPayload: result.rawPayload as Prisma.InputJsonValue,
      },
    });
  }

  private async applyApprovedPayment(
    paymentId: string,
    extra: { provider: string; providerPaymentId?: string; rawPayload?: unknown },
  ) {
    const order = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'APPROVED',
          ...(extra.providerPaymentId ? { providerPaymentId: extra.providerPaymentId } : {}),
          ...(extra.rawPayload ? { rawPayload: extra.rawPayload as Prisma.InputJsonValue } : {}),
        },
      });

      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });

      // El saldo es el SEGUNDO cobro de la misma orden: el stock ya se descontó
      // cuando se aprobó la seña. Volver a consumirlo acá lo restaría dos veces.
      const isBalance = payment.kind === 'BALANCE';

      if (!isBalance) {
        const inStockLines = currentOrder.items
          .filter((item) => item.fulfillmentMode === 'IN_STOCK' && item.variantId)
          .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));
        await this.stock.consume(tx, inStockLines);
      }

      const hasPreorderItems = currentOrder.items.some((item) => item.fulfillmentMode === 'PREORDER');
      const financialStatus: OrderFinancialStatus =
        payment.kind === 'FULL' || isBalance ? 'PAID' : 'DEPOSIT_PAID';

      const updated = await tx.order.update({
        where: { id: currentOrder.id },
        data: {
          financialStatus,
          fulfillmentStatus: isBalance
            ? 'READY'
            : hasPreorderItems
              ? 'AWAITING_IMPORT'
              : currentOrder.fulfillmentStatus,
          expiresAt: null,
        },
      });

      // Cobrado el saldo, el link de pago queda cerrado para que no se pueda reusar.
      if (isBalance) {
        await tx.paymentLink.updateMany({
          where: { orderId: currentOrder.id, status: 'PENDING' },
          data: { status: 'PAID', paidAt: new Date() },
        });
      }

      await tx.orderEvent.create({
        data: {
          orderId: currentOrder.id,
          type: isBalance ? 'balance_paid' : 'payment_approved',
          message: `${isBalance ? 'Saldo cobrado' : 'Pago aprobado'} vía ${extra.provider}`,
        },
      });

      return updated;
    });

    const mailContext = {
      number: order.number,
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      totalCents: order.totalCents,
      dueTodayCents: order.depositCents ?? order.totalCents,
      paymentPlan: order.paymentPlan,
    };
    await this.mail.sendSaleAlert(mailContext, 'Pago aprobado');
    await this.push.broadcast({
      title: `Pago aprobado ${formatOrderNumber(order.number)}`,
      body: order.contactName,
      url: `/pedidos/${order.id}`,
    });
  }

  private toSummaryDto(order: Order): OrderSummaryDto {
    return {
      id: order.id,
      number: order.number,
      displayNumber: formatOrderNumber(order.number),
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      paymentPlan: order.paymentPlan,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalCents: order.totalCents,
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toDetailDto(order: OrderWithRelations): OrderDetailDto {
    return {
      ...this.toSummaryDto(order),
      contactPhone: order.contactPhone,
      pickupInStore: order.pickupInStore,
      shippingStreet: order.shippingStreet,
      shippingNumber: order.shippingNumber,
      shippingFloor: order.shippingFloor,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      shippingPostalCode: order.shippingPostalCode,
      shippingNotes: order.shippingNotes,
      subtotalCents: order.subtotalCents,
      depositCents: order.depositCents,
      balanceCents: order.balanceCents,
      shippingCents: order.shippingCents,
      notes: order.notes,
      items: order.items.map((item) => ({
        id: item.id,
        productName: item.productName,
        variantSku: item.variantSku,
        optionsLabel: item.optionsLabel,
        imageUrl: item.imageUrl,
        unitPriceCents: item.unitPriceCents,
        quantity: item.quantity,
        totalCents: item.totalCents,
        fulfillmentMode: item.fulfillmentMode,
        customization: item.customization
          ? {
              playerName: item.customization.playerName,
              playerNumber: item.customization.playerNumber,
              extraCents: item.customization.extraCents,
              previewImageUrl: item.customization.previewImageUrl,
              productionImageUrl: item.customization.productionImageUrl,
            }
          : null,
      })),
      events: order.events.map((event) => ({
        id: event.id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        kind: payment.kind,
        provider: payment.provider,
        amountCents: payment.amountCents,
        status: payment.status,
        createdAt: payment.createdAt.toISOString(),
      })),
    };
  }
}
