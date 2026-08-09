import { Module } from '@nestjs/common';

import { CustomizationModule } from '../customization/customization.module';
import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

@Module({
  imports: [TaxonomiesModule, CustomizationModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
