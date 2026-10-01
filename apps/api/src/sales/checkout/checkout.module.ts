import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CustomizationModule } from '../../catalog/customization/customization.module';
import { UploadsModule } from '../../catalog/uploads/uploads.module';
import { TurnstileModule } from '../../common/turnstile/turnstile.module';
import { ShippingModule } from '../../shipping/shipping.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { SettingsModule } from '../settings/settings.module';
import { STOCK_RESERVATION_QUEUE } from '../stock/reservation-queue.constants';
import { StockModule } from '../stock/stock.module';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: STOCK_RESERVATION_QUEUE }),
    CartModule,
    SettingsModule,
    StockModule,
    CustomizationModule,
    UploadsModule,
    PaymentsModule,
    NotificationsModule,
    TurnstileModule,
    ShippingModule,
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
