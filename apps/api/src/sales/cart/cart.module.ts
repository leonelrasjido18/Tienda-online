import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { AbandonedCartController } from './abandoned-cart.controller';
import { ABANDONED_CART_QUEUE } from './abandoned-cart.constants';
import { AbandonedCartProcessor } from './abandoned-cart.processor';
import { AbandonedCartService } from './abandoned-cart.service';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';

@Module({
  imports: [NotificationsModule, BullModule.registerQueue({ name: ABANDONED_CART_QUEUE })],
  controllers: [CartController, AbandonedCartController],
  providers: [CartService, AbandonedCartService, AbandonedCartProcessor],
  exports: [CartService],
})
export class CartModule {}
