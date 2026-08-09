import { Module } from '@nestjs/common';

import { TaxonomiesModule } from '../taxonomies/taxonomies.module';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

@Module({
  imports: [TaxonomiesModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
