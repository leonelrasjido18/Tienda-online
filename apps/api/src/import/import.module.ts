import { Module } from '@nestjs/common';

import { NotificationsModule } from '../sales/notifications/notifications.module';
import { PaymentsModule } from '../sales/payments/payments.module';
import { ShippingModule } from '../shipping/shipping.module';
import { BalanceController } from './balance.controller';
import { BalanceRemindersController } from './balance-reminders.controller';
import { BalanceRemindersService } from './balance-reminders.service';
import { BalanceService } from './balance.service';
import { BatchesController } from './batches.controller';
import { BatchesService } from './batches.service';

@Module({
  imports: [ShippingModule, NotificationsModule, PaymentsModule],
  controllers: [BatchesController, BalanceController, BalanceRemindersController],
  providers: [BatchesService, BalanceService, BalanceRemindersService],
  exports: [BalanceService],
})
export class ImportModule {}
