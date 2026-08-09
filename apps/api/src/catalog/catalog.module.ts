import { Module } from '@nestjs/common';

import { ProductsModule } from './products/products.module';
import { PublicCatalogModule } from './public/public-catalog.module';
import { TaxonomiesModule } from './taxonomies/taxonomies.module';
import { UploadsModule } from './uploads/uploads.module';

@Module({
  imports: [TaxonomiesModule, ProductsModule, UploadsModule, PublicCatalogModule],
})
export class CatalogModule {}
