import { BullModule } from '@nestjs/bullmq';
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
import { ProductionSheetController } from './production-sheet.controller';
import { ProductionSheetService } from './production-sheet.service';
import { PublicPreorderController } from './public-preorder.controller';
import { BALANCE_REMINDERS_QUEUE } from './import-queue.constants';
import { BalanceRemindersProcessor } from './balance-reminders.processor';

@Module({
  imports: [
    ShippingModule,
    NotificationsModule,
    PaymentsModule,
    BullModule.registerQueue({ name: BALANCE_REMINDERS_QUEUE }),
  ],
  controllers: [
    BatchesController,
    BalanceController,
    BalanceRemindersController,
    ProductionSheetController,
    PublicPreorderController,
  ],
  providers: [
    BatchesService,
    BalanceService,
    BalanceRemindersService,
    ProductionSheetService,
    BalanceRemindersProcessor,
  ],
  exports: [BalanceService, ProductionSheetService],
})
export class ImportModule {}
