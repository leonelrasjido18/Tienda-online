import { Module } from '@nestjs/common';

import { BrandsController } from './brands.controller';
import { BrandsService } from './brands.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { SeasonsController } from './seasons.controller';
import { SeasonsService } from './seasons.service';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';

@Module({
  controllers: [LeaguesController, TeamsController, SeasonsController, BrandsController, CategoriesController],
  providers: [LeaguesService, TeamsService, SeasonsService, BrandsService, CategoriesService],
  exports: [LeaguesService, TeamsService, SeasonsService, BrandsService, CategoriesService],
})
export class TaxonomiesModule {}
