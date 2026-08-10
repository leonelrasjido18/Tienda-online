import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { STOCK_RESERVATION_QUEUE } from '../stock/reservation-queue.constants';
import { StockModule } from '../stock/stock.module';
import { AdminOrdersController } from './admin-orders.controller';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { ReservationExpiryProcessor } from './reservation-expiry.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: STOCK_RESERVATION_QUEUE }),
    StockModule,
    NotificationsModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [AdminOrdersController, OrdersController],
  providers: [OrdersService, ReservationExpiryProcessor],
  exports: [OrdersService],
})
export class OrdersModule {}
