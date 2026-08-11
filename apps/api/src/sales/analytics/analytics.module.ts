import { Module } from '@nestjs/common';

import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';
import { MetaConversionsService } from './meta-conversions.service';

@Module({
  controllers: [FeedsController],
  providers: [FeedsService, MetaConversionsService],
  exports: [MetaConversionsService],
})
export class AnalyticsModule {}
