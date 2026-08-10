import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { STOCK_RESERVATION_QUEUE } from '../stock/reservation-queue.constants';
import { StockModule } from '../stock/stock.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReservationExpiryProcessor } from './reservation-expiry.processor';

@Module({
  imports: [BullModule.registerQueue({ name: STOCK_RESERVATION_QUEUE }), StockModule, NotificationsModule],
  controllers: [AdminOrdersController, OrdersController],
  providers: [OrdersService, ReservationExpiryProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
