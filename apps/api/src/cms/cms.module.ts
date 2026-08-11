import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller';
import { FaqsController } from './faqs.controller';
import { CouponsController } from './coupons.controller';
import { CouponValidationController } from './coupon-validation.controller';
import { DashboardController } from './dashboard.controller';

@Module({
  controllers: [PagesController, FaqsController, CouponsController, CouponValidationController, DashboardController],
})
export class CmsModule {}
