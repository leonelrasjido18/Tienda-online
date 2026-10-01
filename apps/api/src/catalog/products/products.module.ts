import { Module } from '@nestjs/common';

import { CustomizationModule } from '../customization/customization.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BulkPricingController } from './bulk-pricing.controller';
import { BulkPricingService } from './bulk-pricing.service';
import { ProductNamerService } from './product-namer.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [UploadsModule, CustomizationModule],
  controllers: [ProductsController, BulkPricingController],
  providers: [ProductsService, ProductNamerService, BulkPricingService],
  exports: [ProductsService],
})
export class ProductsModule {}
