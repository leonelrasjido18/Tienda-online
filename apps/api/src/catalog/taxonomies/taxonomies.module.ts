import { Module } from '@nestjs/common';

import { UploadsModule } from '../uploads/uploads.module';
import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { SeasonsController } from './seasons.controller';
import { SeasonsService } from './seasons.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  imports: [UploadsModule],
  controllers: [
    LeaguesController,
    TeamsController,
    SeasonsController,
    BrandsController,
    CategoriesController,
    CollectionsController,
  ],
  providers: [LeaguesService, TeamsService, SeasonsService, BrandsService, CategoriesService, CollectionsService],
  exports: [LeaguesService, TeamsService, SeasonsService, BrandsService, CategoriesService, CollectionsService],
})
export class TaxonomiesModule {}
