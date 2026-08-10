import { Module } from '@nestjs/common';

import { PaymentsModule } from '../payments/payments.module';
import { PublicSettingsController } from './public-settings.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [PaymentsModule],
  controllers: [SettingsController, PublicSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
