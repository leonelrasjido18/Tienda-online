import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface ReservationLine {
  variantId: string;
  quantity: number;
}

@Injectable()
export class StockReservationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bloquea las filas de inventario involucradas para que la lectura de disponibilidad sea consistente. */
  async lockInventory(tx: Tx, variantIds: string[]) {
    if (variantIds.length === 0) return new Map<string, { quantity: number; reserved: number }>();

    const rows = await tx.$queryRaw<{ variantId: string; quantity: number; reserved: number }[]>`
      SELECT "variantId", quantity, reserved FROM inventory_items WHERE "variantId" = ANY(${variantIds}) FOR UPDATE
    `;
    return new Map(rows.map((r) => [r.variantId, { quantity: r.quantity, reserved: r.reserved }]));
  }

  async reserve(tx: Tx, lines: ReservationLine[]) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { reserved: { increment: line.quantity } },
      });
    }
  }

  /** Libera una reserva sin descontar stock real (orden expirada o cancelada antes de pagar). */
  async release(tx: Tx, lines: ReservationLine[]) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { reserved: { decrement: line.quantity } },
      });
    }
  }

  /** Devuelve stock real tras una cancelación o devolución, incrementando la cantidad disponible. */
  async returnStock(tx: Tx, lines: ReservationLine[]) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { quantity: { increment: line.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: line.variantId, type: 'RETURN', quantity: line.quantity, reason: 'Pedido cancelado' },
      });
    }
  }

  /** Descuenta stock real tras un pago aprobado, liberando la reserva correspondiente. */
  async consume(tx: Tx, lines: ReservationLine[]) {
    for (const line of lines) {
      await tx.inventoryItem.update({
        where: { variantId: line.variantId },
        data: { quantity: { decrement: line.quantity }, reserved: { decrement: line.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: line.variantId, type: 'SALE', quantity: -line.quantity, reason: 'Pago aprobado' },
      });
    }
  }
}
