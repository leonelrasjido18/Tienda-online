import { Module } from '@nestjs/common';

import { CustomizationModule } from '../customization/customization.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProductNamerService } from './product-namer.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [UploadsModule, CustomizationModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductNamerService],
  exports: [ProductsService],
})
export class ProductsModule {}
