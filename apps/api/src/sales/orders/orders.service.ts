import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import {
  formatCentsAsArs,
  formatOrderNumber,
  type OrderDetailDto,
  type OrderFinancialStatus,
  type PublicOrderDetailDto,
  type ShipmentStatus,
  type OrderSummaryDto,
  type PaymentStatus as PaymentStatusValue,
  canTransitionOrderFinancial,
  canTransitionPayment,
  OFFLINE_PAYMENT_METHODS,
} from '@tienda/shared';
import type { Order, Payment, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { PushService } from '../notifications/push.service';
import { StockReservationService } from '../stock/stock-reservation.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { MetaConversionsService } from '../analytics/meta-conversions.service';

const ORDER_DETAIL_INCLUDE = {
  items: {
    include: {
      customization: true,
      // Para enlazar a la ficha del producto y para poder decir "Talle: S" en
      // vez de sólo "S": `optionsLabel` guarda los valores sin su etiqueta.
      variant: {
        include: {
          product: { select: { slug: true } },
          optionValues: { include: { value: { include: { option: { select: { name: true, position: true } } } } } },
        },
      },
    },
  },
  events: { orderBy: { createdAt: 'asc' as const } },
  payments: { orderBy: { createdAt: 'asc' as const } },
  shipment: true,
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_DETAIL_INCLUDE }>;

/**
 * Nombres de tipografías y parches, resueltos aparte. La personalización guarda
 * `fontId` y `patchIds` (Json), que no sirven ni en un mail ni en el panel.
 */
export interface CustomizationNames {
  fonts: Map<string, string>;
  patches: Map<string, string>;
}

const SIN_NOMBRES: CustomizationNames = { fonts: new Map(), patches: new Map() };

export interface AdminOrderListQuery {
  financialStatus?: OrderFinancialStatus;
  q?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockReservationService,
    private readonly mail: MailService,
    private readonly push: PushService,
    private readonly metaConversions: MetaConversionsService,
    @Inject(forwardRef(() => PaymentProviderRegistry))
    private readonly paymentRegistry: PaymentProviderRegistry,
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
    return this.toDetailDto(order, await this.resolveCustomizationNames(order));
  }

  /**
   * Traduce `fontId` y `patchIds` a nombres legibles, en dos consultas para todo
   * el pedido en vez de una por ítem.
   */
  async resolveCustomizationNames(order: OrderWithRelations): Promise<CustomizationNames> {
    const fontIds = new Set<string>();
    const patchIds = new Set<string>();
    for (const item of order.items) {
      if (!item.customization) continue;
      if (item.customization.fontId) fontIds.add(item.customization.fontId);
      // `patchIds` es Json: puede venir null, o con basura si alguien lo editó a mano.
      const brutos = item.customization.patchIds;
      if (Array.isArray(brutos)) {
        for (const id of brutos) if (typeof id === 'string') patchIds.add(id);
      }
    }
    if (!fontIds.size && !patchIds.size) return SIN_NOMBRES;

    const [fonts, patches] = await Promise.all([
      fontIds.size
        ? this.prisma.leagueFont.findMany({ where: { id: { in: [...fontIds] } }, select: { id: true, name: true } })
        : Promise.resolve([]),
      patchIds.size
        ? this.prisma.patch.findMany({ where: { id: { in: [...patchIds] } }, select: { id: true, name: true } })
        : Promise.resolve([]),
    ]);
    return {
      fonts: new Map(fonts.map((f) => [f.id, f.name])),
      patches: new Map(patches.map((p) => [p.id, p.name])),
    };
  }

  async publicDetail(token: string): Promise<PublicOrderDetailDto> {
    const order = await this.prisma.order.findUnique({ where: { publicToken: token }, include: ORDER_DETAIL_INCLUDE });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }
    return {
      displayNumber: formatOrderNumber(order.number),
      contactName: order.contactName,
      paymentPlan: order.paymentPlan,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      totalCents: order.totalCents,
      balanceCents: order.balanceCents,
      pickupInStore: order.pickupInStore,
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

  /** Aprobación manual de una transferencia bancaria desde el panel. */
  /**
   * Da por cobrado un pago sin pasarela. Vale para transferencia y para
   * efectivo: los dos los confirma la dueña a mano cuando recibe la plata, y
   * antes el efectivo no tenía forma de marcarse como pagado.
   *
   * Dispara lo mismo que un pago con tarjeta aprobado: confirmación al cliente,
   * aviso de venta y, si el pedido es por encargo, la asignación al lote.
   */
  async approveOfflinePayment(orderId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.orderId !== orderId) {
      throw new NotFoundException('El pago no existe para este pedido');
    }
    if (!(OFFLINE_PAYMENT_METHODS as readonly string[]).includes(payment.provider)) {
      throw new BadRequestException(
        'Este pago se cobra por la pasarela: se confirma solo cuando el proveedor avisa.',
      );
    }
    if (payment.status === 'APPROVED') {
      return this.detail(orderId);
    }

    await this.applyApprovedPayment(payment.id, { provider: payment.provider });
    return this.detail(orderId);
  }

  /**
   * Reenvía la confirmación al cliente con el detalle actual del pedido.
   *
   * Se exige que el pedido esté cobrado: mandar "confirmamos tu pedido" sobre
   * uno pendiente o cancelado es justo lo que se corrigió al mover los correos
   * al momento del pago.
   */
  async resendConfirmation(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }
    const cobrado = ['DEPOSIT_PAID', 'AWAITING_BALANCE', 'PAID'].includes(order.financialStatus);
    if (!cobrado) {
      throw new BadRequestException(
        `No se puede reenviar la confirmación de un pedido ${order.financialStatus}: todavía no está cobrado.`,
      );
    }

    const detalle = this.toDetailDto(order, await this.resolveCustomizationNames(order));
    const cobradoCents = order.depositCents ?? order.totalCents;
    await this.mail.sendOrderConfirmation({ ...detalle, dueTodayCents: cobradoCents });

    await this.prisma.orderEvent.create({
      data: { orderId, type: 'confirmation_resent', message: `Confirmación reenviada a ${order.contactEmail}` },
    });

    return { success: true, sentTo: order.contactEmail };
  }

  async cancel(orderId: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }
    if (order.fulfillmentStatus === 'CANCELLED') {
      throw new BadRequestException('El pedido ya está cancelado');
    }
    if (order.fulfillmentStatus === 'FULFILLED') {
      throw new BadRequestException('No se puede cancelar un pedido ya despachado');
    }

    await this.prisma.$transaction(async (tx) => {
      const inStockLines = order.items
        .filter((item) => item.fulfillmentMode === 'IN_STOCK' && item.variantId)
        .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));

      if (order.financialStatus === 'PENDING') {
        await this.stock.release(tx, inStockLines);
      } else if (['DEPOSIT_PAID', 'AWAITING_BALANCE', 'PAID'].includes(order.financialStatus)) {
        await this.stock.returnStock(tx, inStockLines);
      }

      const finalFinancialStatus = ['DEPOSIT_PAID', 'AWAITING_BALANCE', 'PAID'].includes(order.financialStatus)
        ? 'REFUNDED'
        : order.financialStatus;

      if (order.financialStatus !== finalFinancialStatus) {
        if (!canTransitionOrderFinancial(order.financialStatus, finalFinancialStatus)) {
          throw new BadRequestException(
            `Transición inválida: no se puede pasar el estado financiero de ${order.financialStatus} a ${finalFinancialStatus}`,
          );
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: 'CANCELLED',
          financialStatus: finalFinancialStatus,
          expiresAt: null,
        },
      });

      await tx.paymentLink.updateMany({
        where: { orderId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'cancelled',
          message: `Pedido cancelado. Motivo: ${reason ?? 'No especificado'}`,
        },
      });
    });

    return this.detail(orderId);
  }

  async refund(orderId: string, input: { amountCents: number; reason?: string }) {
    const { amountCents, reason } = input;
    if (amountCents <= 0) {
      throw new BadRequestException('El monto a reembolsar debe ser mayor a cero');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { payments: true },
    });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }

    const approvedPayments = order.payments.filter(
      (p) => p.status === 'APPROVED' && ['FULL', 'DEPOSIT', 'BALANCE'].includes(p.kind),
    );
    if (approvedPayments.length === 0) {
      throw new BadRequestException('El pedido no tiene pagos aprobados para reembolsar');
    }

    // Buscamos un pago que no sea de transferencia bancaria si es posible, o usamos el más reciente.
    const payablePayment = approvedPayments.find((p) => p.provider !== 'bank_transfer') ?? approvedPayments[0];
    if (!payablePayment) {
      throw new BadRequestException('El pedido no tiene pagos aprobados para reembolsar');
    }

    let providerRefundId: string | null = null;

    if (payablePayment.provider !== 'bank_transfer' && payablePayment.providerPaymentId) {
      const provider = this.paymentRegistry.byName(payablePayment.provider);
      if (provider && provider.refund) {
        try {
          const res = await provider.refund(payablePayment.providerPaymentId, amountCents);
          providerRefundId = res.providerRefundId;
        } catch (error) {
          throw new BadRequestException(
            `Error al reembolsar con el proveedor: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Reconsultar pagos aprobados y reembolsos dentro de la transacción
      const allPayments = await tx.payment.findMany({
        where: { orderId, status: 'APPROVED' },
      });

      const totalApproved = allPayments
        .filter((p) => ['FULL', 'DEPOSIT', 'BALANCE'].includes(p.kind))
        .reduce((sum, p) => sum + p.amountCents, 0);

      const totalRefunded = allPayments
        .filter((p) => p.kind === 'REFUND')
        .reduce((sum, p) => sum + Math.abs(p.amountCents), 0);

      if (totalRefunded + amountCents > totalApproved) {
        throw new BadRequestException(
          `El reembolso de ${formatCentsAsArs(amountCents)} excede el saldo reembolsable disponible de ${formatCentsAsArs(totalApproved - totalRefunded)}`,
        );
      }

      await tx.payment.create({
        data: {
          orderId,
          kind: 'REFUND',
          provider: payablePayment.provider,
          providerPaymentId: providerRefundId,
          amountCents: -amountCents,
          status: 'APPROVED',
          rawPayload: { reason: reason ?? null } as Prisma.InputJsonValue,
        },
      });

      const newTotalRefunded = totalRefunded + amountCents;
      const newFinancialStatus = newTotalRefunded >= totalApproved ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

      if (order.financialStatus !== newFinancialStatus) {
        if (!canTransitionOrderFinancial(order.financialStatus, newFinancialStatus)) {
          throw new BadRequestException(
            `Transición inválida: no se puede pasar el estado financiero de ${order.financialStatus} a ${newFinancialStatus}`,
          );
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          financialStatus: newFinancialStatus,
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'refunded',
          message: `Reembolso de ${formatCentsAsArs(amountCents)} procesado vía ${payablePayment.provider}. Motivo: ${reason ?? 'No especificado'}`,
        },
      });

      return this.toDetailDto(
        await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: ORDER_DETAIL_INCLUDE,
        }) as OrderWithRelations
      );
    });
  }

  async createShipment(orderId: string, input: { provider: string; trackingNumber: string; labelUrl?: string | null }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });
    if (!order) {
      throw new NotFoundException('El pedido no existe');
    }
    if (order.shipment) {
      throw new BadRequestException('El pedido ya tiene un envío registrado');
    }
    if (order.fulfillmentStatus === 'CANCELLED') {
      throw new BadRequestException('No se puede despachar un pedido cancelado');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shipment.create({
        data: {
          orderId,
          provider: input.provider,
          trackingNumber: input.trackingNumber,
          labelUrl: input.labelUrl ?? null,
          status: 'SHIPPED',
          shippedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          fulfillmentStatus: 'FULFILLED',
        },
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          type: 'shipped',
          message: `Pedido despachado vía ${input.provider}. Código de seguimiento: ${input.trackingNumber}`,
        },
      });
    });

    // Enviar email de despacho
    await this.mail.sendShipmentNotification({
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      number: order.number,
      provider: input.provider,
      trackingNumber: input.trackingNumber,
    });

    return this.detail(orderId);
  }

  async updateShipment(orderId: string, input: { status: string; trackingNumber?: string }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipment: true },
    });
    if (!order || !order.shipment) {
      throw new NotFoundException('El envío no existe para este pedido');
    }

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.ShipmentUpdateInput = {
        status: input.status,
      };
      if (input.trackingNumber) {
        data.trackingNumber = input.trackingNumber;
      }
      if (input.status === 'DELIVERED') {
        data.deliveredAt = new Date();
      }

      await tx.shipment.update({
        where: { orderId },
        data,
      });

      await tx.orderEvent.create({
        data: {
          orderId,
          type: `shipment_${input.status.toLowerCase()}`,
          message: `Estado del envío actualizado a: ${input.status}`,
        },
      });
    });

    return this.detail(orderId);
  }

  /**
   * Aplica el resultado ya verificado de un pago, venga de la pasarela que venga.
   * El estado llega normalizado por el PaymentProvider correspondiente.
   */
  async applyPaymentStatus(
    paymentId: string,
    result: {
      provider: string;
      status: PaymentStatusValue;
      providerPaymentId: string;
      amountCents: number;
      currency?: string;
      rawPayload: unknown;
    },
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    if (payment.provider !== result.provider || payment.amountCents !== result.amountCents || result.currency && result.currency !== 'ARS') {
      throw new BadRequestException('El webhook no coincide con el pago esperado');
    }

    if (result.status === 'APPROVED' && payment.status !== 'APPROVED') {
      await this.applyApprovedPayment(payment.id, {
        provider: result.provider,
        providerPaymentId: result.providerPaymentId,
        rawPayload: result.rawPayload,
      });
      return;
    }

    // Los eventos fuera de orden no pueden degradar un pago ya confirmado.
    if (payment.status === 'APPROVED') return;

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
    const resultado = await this.prisma.$transaction(async (tx) => {
      // La comprobación previa al entrar al método no es suficiente: dos
      // webhooks distintos pueden llegar a la vez. Se bloquea la fila antes de
      // decidir la transición para que sólo uno consuma la reserva.
      const [lockedPayment] = await tx.$queryRaw<Payment[]>`
        SELECT * FROM payments WHERE id = ${paymentId} FOR UPDATE
      `;
      // Se acepta desde PENDING y tambien desde REJECTED: la pasarela permite
      // reintentar sobre el mismo pago, y un rechazo previo no puede descartar
      // la aprobacion posterior.
      if (!lockedPayment || lockedPayment.status === 'APPROVED') {
        return null;
      }
      if (lockedPayment.status !== 'PENDING' && lockedPayment.status !== 'REJECTED') {
        return null;
      }

      if (!canTransitionPayment(lockedPayment.status as PaymentStatusValue, 'APPROVED')) {
        throw new BadRequestException(
          `Transición inválida: no se puede pasar el estado del pago de ${lockedPayment.status} a APPROVED`,
        );
      }

      const payment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'APPROVED',
          ...(extra.providerPaymentId ? { providerPaymentId: extra.providerPaymentId } : {}),
          ...(extra.rawPayload ? { rawPayload: extra.rawPayload as Prisma.InputJsonValue } : {}),
        },
      });

      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${payment.orderId} FOR UPDATE`;
      const currentOrder = await tx.order.findUniqueOrThrow({
        where: { id: payment.orderId },
        include: { items: true },
      });

      // Pago que entra cuando el pedido ya estaba cerrado. El cobro es real y el
      // pago queda APPROVED, pero el pedido no se revive solo: la reserva se
      // liberó y ese stock puede haberse vendido, asi que revivirlo a ciegas
      // sobrevendería. Queda anotado y se avisa al dueño para que resuelva.
      if (currentOrder.financialStatus === 'EXPIRED' || currentOrder.financialStatus === 'FAILED') {
        await tx.orderEvent.create({
          data: {
            orderId: currentOrder.id,
            type: 'payment_after_close',
            message: `Pago aprobado vía ${extra.provider} sobre un pedido ya ${currentOrder.financialStatus}. Requiere revisión manual.`,
          },
        });
        return { order: currentOrder, isBalance: false, cobradoCents: payment.amountCents, pagoTardio: true };
      }

      // El saldo es el SEGUNDO cobro de la misma orden: el stock ya se descontó
      // cuando se aprobó la seña. Volver a consumirlo acá lo restaría dos veces.
      const isBalance = payment.kind === 'BALANCE';

      if (!isBalance) {
        const inStockLines = currentOrder.items
          .filter((item) => item.fulfillmentMode === 'IN_STOCK' && item.variantId)
          .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));
        await this.stock.lockInventory(tx, inStockLines.map((line) => line.variantId));
        await this.stock.consume(tx, inStockLines);
      }

      const hasPreorderItems = currentOrder.items.some((item) => item.fulfillmentMode === 'PREORDER');
      const financialStatus: OrderFinancialStatus =
        payment.kind === 'FULL' || isBalance ? 'PAID' : 'DEPOSIT_PAID';

      if (currentOrder.financialStatus !== financialStatus) {
        if (!canTransitionOrderFinancial(currentOrder.financialStatus, financialStatus)) {
          throw new BadRequestException(
            `Transición inválida: no se puede pasar el estado financiero del pedido de ${currentOrder.financialStatus} a ${financialStatus}`,
          );
        }
      }

      // Al cobrar la seña de un pedido por encargo, se suma solo a la ventana de
      // encargo activa (si hay una abierta y sin lote ya asignado a mano).
      let importBatchId: string | undefined;
      if (!isBalance && hasPreorderItems && !currentOrder.importBatchId) {
        const activeWindow = await tx.importBatch.findFirst({
          where: { isActive: true, status: 'OPEN', closesAt: { gt: new Date() } },
          select: { id: true },
        });
        importBatchId = activeWindow?.id;
      }

      const updated = await tx.order.update({
        where: { id: currentOrder.id },
        data: {
          financialStatus,
          fulfillmentStatus: isBalance
            ? 'READY'
            : hasPreorderItems
              ? 'AWAITING_IMPORT'
              : currentOrder.fulfillmentStatus,
          ...(importBatchId ? { importBatchId } : {}),
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

      return { order: updated, isBalance, cobradoCents: payment.amountCents, pagoTardio: false };
    });

    if (!resultado) return;
    const { order, isBalance, cobradoCents, pagoTardio } = resultado;

    // Un cobro sobre un pedido ya cerrado no le manda nada al cliente: hay que
    // decidir primero si se reactiva el pedido o se devuelve la plata.
    if (pagoTardio) {
      this.logger.error(
        `Pago aprobado sobre el pedido ${formatOrderNumber(order.number)} que estaba ${order.financialStatus}. Revisar a mano.`,
      );
      await this.push.broadcast({
        title: `Revisar pedido ${formatOrderNumber(order.number)}`,
        body: 'Se aprobó un pago sobre un pedido ya cerrado',
        url: `/dashboard/pedidos/${order.id}`,
        orderId: order.id,
      });
      return;
    }

    // El detalle completo (opciones, personalización, envío) se arma una sola vez
    // y lo comparten los dos mails, así el cliente y el dueño ven lo mismo.
    const detalle = await this.prisma.order.findUnique({ where: { id: order.id }, include: ORDER_DETAIL_INCLUDE });
    const mailContext = detalle
      ? { ...this.toDetailDto(detalle, await this.resolveCustomizationNames(detalle)), dueTodayCents: cobradoCents }
      : null;

    if (mailContext) {
      // La confirmación sale con el primer cobro (seña o pago total). Cuando
      // entra el saldo el cliente ya la recibió: repetirla sería confuso, y para
      // eso está `sendBalanceRequest`.
      if (!isBalance) {
        await this.mail.sendOrderConfirmation(mailContext);
      }
      await this.mail.sendSaleAlert(mailContext, isBalance ? 'Saldo cobrado' : 'Pago aprobado');
    }
    await this.push.broadcast({
      title: `Pago aprobado ${formatOrderNumber(order.number)}`,
      body: order.contactName,
      url: `/dashboard/pedidos/${order.id}`,
      orderId: order.id,
    });

    // Purchase a Meta CAPI sólo cuando la compra quedó completa (PAID). event_id =
    // número de orden para deduplicar contra el Pixel del navegador. No bloquea:
    // el servicio nunca lanza.
    if (order.financialStatus === 'PAID') {
      await this.metaConversions.trackPurchase({
        eventId: `order-${order.number}`,
        email: order.contactEmail,
        phone: order.contactPhone,
        valueCents: order.totalCents,
      });
    }
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

  toDetailDto(order: OrderWithRelations, nombres: CustomizationNames = SIN_NOMBRES): OrderDetailDto {
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
        // El producto puede haberse borrado después de la venta: la variante
        // queda en null y el ítem conserva el nombre, pero ya no hay ficha.
        productSlug: item.variant?.product.slug ?? null,
        variantSku: item.variantSku,
        optionsLabel: item.optionsLabel,
        options: (item.variant?.optionValues ?? [])
          .slice()
          .sort((a, b) => a.value.option.position - b.value.option.position)
          .map((ov) => ({ name: ov.value.option.name, value: ov.value.value })),
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
              fontName: item.customization.fontId ? (nombres.fonts.get(item.customization.fontId) ?? null) : null,
              patchNames: Array.isArray(item.customization.patchIds)
                ? item.customization.patchIds
                    .filter((id): id is string => typeof id === 'string')
                    .map((id) => nombres.patches.get(id))
                    .filter((n): n is string => !!n)
                : [],
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
      shipment: order.shipment
        ? {
            id: order.shipment.id,
            orderId: order.shipment.orderId,
            provider: order.shipment.provider,
            trackingNumber: order.shipment.trackingNumber,
            labelUrl: order.shipment.labelUrl,
            status: order.shipment.status as ShipmentStatus,
            shippedAt: order.shipment.shippedAt?.toISOString() ?? null,
            deliveredAt: order.shipment.deliveredAt?.toISOString() ?? null,
            createdAt: order.shipment.createdAt.toISOString(),
            updatedAt: order.shipment.updatedAt.toISOString(),
          }
        : null,
    };
  }
}
