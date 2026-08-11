import { Module } from '@nestjs/common';

import { AnalyticsModule } from './analytics/analytics.module';
import { CartModule } from './cart/cart.module';
import { CheckoutModule } from './checkout/checkout.module';
import { CustomersAuthModule } from './customers-auth/customers-auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    CartModule,
    SettingsModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    CheckoutModule,
    CustomersAuthModule,
    ReviewsModule,
    AnalyticsModule,
  ],
})
export class SalesModule {}
