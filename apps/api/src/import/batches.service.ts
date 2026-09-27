import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  canTransition,
  formatOrderNumber,
  IMPORT_BATCH_STATUS_LABELS,
  type CreateImportBatchInput,
  type ImportBatchDetailDto,
  type ImportBatchStatus,
  type ImportBatchSummaryDto,
  type UpdateImportBatchInput,
} from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { BalanceService } from './balance.service';

const BATCH_INCLUDE = {
  orders: {
    include: { items: { select: { id: true, quantity: true, fulfillmentMode: true } } },
    orderBy: { number: 'asc' as const },
  },
  events: { orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ImportBatchInclude;

type BatchWithRelations = Prisma.ImportBatchGetPayload<{ include: typeof BATCH_INCLUDE }>;

/** Una linea con la direccion, para pegar tal cual en el sitio de Correo. */
function direccionDe(order: {
  pickupInStore: boolean;
  shippingStreet: string | null;
  shippingNumber: string | null;
  shippingFloor: string | null;
  shippingCity: string | null;
  shippingProvince: string | null;
  shippingPostalCode: string | null;
}): string | null {
  if (order.pickupInStore) return null;
  return (
    [
      [order.shippingStreet, order.shippingNumber].filter(Boolean).join(' '),
      order.shippingFloor,
      order.shippingCity,
      order.shippingProvince,
      order.shippingPostalCode ? `CP ${order.shippingPostalCode}` : null,
    ]
      .filter(Boolean)
      .join(', ') || null
  );
}

@Injectable()
export class BatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
  ) {}

  async list(): Promise<ImportBatchSummaryDto[]> {
    const batches = await this.prisma.importBatch.findMany({
      include: BATCH_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return batches.map((batch) => this.toSummary(batch));
  }

  async detail(id: string): Promise<ImportBatchDetailDto> {
    const batch = await this.findOrThrow(id);
    return {
      ...this.toSummary(batch),
      trackingRef: batch.trackingRef,
      freightCents: batch.freightCents,
      customsCents: batch.customsCents,
      otherfeeCents: batch.otherfeeCents,
      notes: batch.notes,
      orders: batch.orders.map((order) => ({
        id: order.id,
        displayNumber: formatOrderNumber(order.number),
        contactName: order.contactName,
        contactEmail: order.contactEmail,
        balanceCents: order.balanceCents,
        shippingCents: order.shippingCents,
        financialStatus: order.financialStatus,
        province: order.shippingProvince,
        pickupInStore: order.pickupInStore,
        itemCount: order.items.length,
        shippingAddress: direccionDe(order),
        postalCode: order.shippingPostalCode,
        contactPhone: order.contactPhone,
      })),
      events: batch.events.map((event) => ({
        id: event.id,
        type: event.type,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }

  async create(input: CreateImportBatchInput) {
    const existing = await this.prisma.importBatch.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new BadRequestException(`Ya existe un lote con el código ${input.code}`);
    }

    const batch = await this.prisma.importBatch.create({
      data: {
        code: input.code,
        supplier: input.supplier ?? null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        etaDate: input.etaDate ? new Date(input.etaDate) : null,
        promisedDeliveryDays: input.promisedDeliveryDays ?? null,
        ...(input.minUnits !== undefined ? { minUnits: input.minUnits } : {}),
        notes: input.notes ?? null,
        events: { create: { type: 'created', message: 'Lote creado' } },
      },
    });
    return this.detail(batch.id);
  }

  async update(id: string, input: UpdateImportBatchInput) {
    await this.findOrThrow(id);
    await this.prisma.importBatch.update({
      where: { id },
      data: {
        supplier: input.supplier ?? null,
        closesAt: input.closesAt ? new Date(input.closesAt) : null,
        etaDate: input.etaDate ? new Date(input.etaDate) : null,
        promisedDeliveryDays: input.promisedDeliveryDays ?? null,
        ...(input.minUnits !== undefined ? { minUnits: input.minUnits } : {}),
        trackingRef: input.trackingRef ?? null,
        freightCents: input.freightCents ?? null,
        customsCents: input.customsCents ?? null,
        otherfeeCents: input.otherfeeCents ?? null,
        notes: input.notes ?? null,
      },
    });
    return this.detail(id);
  }

  /**
   * Marca este lote como la ventana de encargo pública activa. Sólo una puede
   * estarlo: al activar una, se desactivan las demás.
   */
  async setActive(id: string, isActive: boolean) {
    await this.findOrThrow(id);
    await this.prisma.$transaction(async (tx) => {
      if (isActive) {
        await tx.importBatch.updateMany({ where: { isActive: true, id: { not: id } }, data: { isActive: false } });
      }
      await tx.importBatch.update({ where: { id }, data: { isActive } });
    });
    return this.detail(id);
  }

  /** Ventana de encargo activa para el storefront (cuenta regresiva). Null si no hay. */
  async getActiveWindow(): Promise<{ closesAt: string; promisedDeliveryDays: number | null } | null> {
    const batch = await this.prisma.importBatch.findFirst({
      where: { isActive: true, status: 'OPEN', closesAt: { gt: new Date() } },
      orderBy: { closesAt: 'asc' },
    });
    if (!batch || !batch.closesAt) return null;
    return { closesAt: batch.closesAt.toISOString(), promisedDeliveryDays: batch.promisedDeliveryDays };
  }

  /** Id de la ventana activa para auto-asignar pedidos por encargo en el checkout. */
  async getActiveWindowId(): Promise<string | null> {
    const batch = await this.prisma.importBatch.findFirst({
      where: { isActive: true, status: 'OPEN', closesAt: { gt: new Date() } },
      select: { id: true },
    });
    return batch?.id ?? null;
  }

  /** Pedidos por encargo con la seña ya cobrada y todavía sin lote asignado. */
  async assignableOrders() {
    const orders = await this.prisma.order.findMany({
      where: {
        importBatchId: null,
        fulfillmentStatus: 'AWAITING_IMPORT',
        financialStatus: { in: ['DEPOSIT_PAID', 'AWAITING_BALANCE'] },
      },
      include: { items: { select: { id: true } } },
      orderBy: { number: 'asc' },
    });

    return orders.map((order) => ({
      id: order.id,
      displayNumber: formatOrderNumber(order.number),
      contactName: order.contactName,
      contactEmail: order.contactEmail,
      balanceCents: order.balanceCents,
      shippingCents: order.shippingCents,
      financialStatus: order.financialStatus,
      province: order.shippingProvince,
      pickupInStore: order.pickupInStore,
      itemCount: order.items.length,
      shippingAddress: direccionDe(order),
      postalCode: order.shippingPostalCode,
      contactPhone: order.contactPhone,
    }));
  }

  async assignOrders(id: string, orderIds: string[]) {
    const batch = await this.findOrThrow(id);
    if (batch.status !== 'OPEN') {
      throw new BadRequestException('Sólo se pueden sumar pedidos a un lote abierto');
    }

    const { count } = await this.prisma.order.updateMany({
      // Se re-valida acá y no sólo en la lectura: entre que el panel listó los
      // pedidos y la clienta confirmó, alguno pudo entrar a otro lote.
      where: { id: { in: orderIds }, importBatchId: null, fulfillmentStatus: 'AWAITING_IMPORT' },
      data: { importBatchId: id },
    });

    await this.prisma.importBatchEvent.create({
      data: { batchId: id, type: 'orders_assigned', message: `${count} pedido(s) asignados al lote` },
    });

    return this.detail(id);
  }

  async removeOrder(id: string, orderId: string) {
    const batch = await this.findOrThrow(id);
    if (batch.status !== 'OPEN') {
      throw new BadRequestException('Sólo se pueden quitar pedidos de un lote abierto');
    }

    await this.prisma.order.updateMany({ where: { id: orderId, importBatchId: id }, data: { importBatchId: null } });
    await this.prisma.importBatchEvent.create({
      data: { batchId: id, type: 'order_removed', message: 'Pedido quitado del lote' },
    });
    return this.detail(id);
  }

  async advance(id: string, target: ImportBatchStatus) {
    const batch = await this.findOrThrow(id);

    if (!canTransition(batch.status, target)) {
      throw new BadRequestException(
        `No se puede pasar de "${IMPORT_BATCH_STATUS_LABELS[batch.status]}" a "${IMPORT_BATCH_STATUS_LABELS[target]}"`,
      );
    }

    if (target === 'ORDERED' && batch.orders.length === 0) {
      throw new BadRequestException('El lote no tiene pedidos asignados');
    }

    await this.prisma.importBatch.update({
      where: { id },
      data: {
        status: target,
        ...(target === 'RECEIVED' ? { receivedAt: new Date() } : {}),
        events: {
          create: { type: 'status_changed', message: `Estado: ${IMPORT_BATCH_STATUS_LABELS[target]}` },
        },
      },
    });

    // Recibir el lote es lo que dispara todo el cobro del saldo.
    if (target === 'RECEIVED') {
      await this.balance.onBatchReceived(id);
    }

    return this.detail(id);
  }

  async remove(id: string) {
    const batch = await this.findOrThrow(id);
    if (batch.status !== 'OPEN') {
      throw new BadRequestException('Sólo se puede eliminar un lote abierto');
    }
    await this.prisma.importBatch.delete({ where: { id } });
    return { success: true };
  }

  private async findOrThrow(id: string): Promise<BatchWithRelations> {
    const batch = await this.prisma.importBatch.findUnique({ where: { id }, include: BATCH_INCLUDE });
    if (!batch) {
      throw new NotFoundException('El lote no existe');
    }
    return batch;
  }

  private toSummary(batch: BatchWithRelations): ImportBatchSummaryDto {
    // Unidades por encargo del lote: la suma de cantidades de los ítems PREORDER,
    // para medir el progreso hacia el cupo mínimo.
    const unitCount = batch.orders.reduce(
      (sum, order) =>
        sum + order.items.filter((i) => i.fulfillmentMode === 'PREORDER').reduce((s, i) => s + i.quantity, 0),
      0,
    );
    return {
      id: batch.id,
      code: batch.code,
      supplier: batch.supplier,
      status: batch.status,
      closesAt: batch.closesAt?.toISOString() ?? null,
      etaDate: batch.etaDate?.toISOString() ?? null,
      receivedAt: batch.receivedAt?.toISOString() ?? null,
      orderCount: batch.orders.length,
      unitCount,
      isActive: batch.isActive,
      promisedDeliveryDays: batch.promisedDeliveryDays,
      minUnits: batch.minUnits,
      pendingBalanceCents: batch.orders.reduce((sum, order) => sum + (order.balanceCents ?? 0), 0),
      createdAt: batch.createdAt.toISOString(),
    };
  }
}
