import { Module } from '@nestjs/common';

import { CustomizationModule } from '../customization/customization.module';
import { UploadsModule } from '../uploads/uploads.module';
import { BulkEditController } from './bulk-edit.controller';
import { BulkEditService } from './bulk-edit.service';
import { BulkPricingController } from './bulk-pricing.controller';
import { BulkPricingService } from './bulk-pricing.service';
import { ProductNamerService } from './product-namer.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [UploadsModule, CustomizationModule],
  controllers: [ProductsController, BulkPricingController, BulkEditController],
  providers: [ProductsService, ProductNamerService, BulkPricingService, BulkEditService],
  exports: [ProductsService],
})
export class ProductsModule {}
