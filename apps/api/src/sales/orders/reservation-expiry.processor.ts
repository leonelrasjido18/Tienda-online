import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { canTransitionOrderFinancial } from '@tienda/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { STOCK_RESERVATION_QUEUE, type StockReservationJobData } from '../stock/reservation-queue.constants';
import { StockReservationService } from '../stock/stock-reservation.service';

@Processor(STOCK_RESERVATION_QUEUE)
export class ReservationExpiryProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpiryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stock: StockReservationService,
  ) {
    super();
  }

  async process(job: Job<StockReservationJobData>) {
    const { orderId } = job.data;

    await this.prisma.$transaction(async (tx) => {
      // Coordina con la aprobación del pago: ambas transiciones compiten por
      // la misma orden y nunca pueden liberar/consumir una reserva en paralelo.
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order || !canTransitionOrderFinancial(order.financialStatus, 'EXPIRED')) return;

      const reservedLines = order.items
        .filter((item) => item.fulfillmentMode === 'IN_STOCK' && item.variantId)
        .map((item) => ({ variantId: item.variantId as string, quantity: item.quantity }));

      await this.stock.release(tx, reservedLines);

      await tx.order.update({
        where: { id: orderId },
        data: { financialStatus: 'EXPIRED', fulfillmentStatus: 'CANCELLED' },
      });

      await tx.orderEvent.create({
        data: { orderId, type: 'expired', message: 'Reserva vencida sin confirmación de pago' },
      });
    });

    this.logger.log(`Reserva expirada procesada para el pedido ${orderId}`);
  }
}
