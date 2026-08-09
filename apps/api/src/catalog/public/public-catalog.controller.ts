import { Controller, Get, Param, Query } from '@nestjs/common';
import { productListQuerySchema } from '@tienda/shared';

import { Public } from '../../auth/decorators/public.decorator';
import { BrandsService } from '../taxonomies/brands.service';
import { CategoriesService } from '../taxonomies/categories.service';
import { LeaguesService } from '../taxonomies/leagues.service';
import { SeasonsService } from '../taxonomies/seasons.service';
import { TeamsService } from '../taxonomies/teams.service';
import { PublicCatalogService } from './public-catalog.service';

@Public()
@Controller('catalog')
export class PublicCatalogController {
  constructor(
    private readonly catalog: PublicCatalogService,
    private readonly leagues: LeaguesService,
    private readonly teams: TeamsService,
    private readonly seasons: SeasonsService,
    private readonly brands: BrandsService,
    private readonly categories: CategoriesService,
  ) {}

  @Get('products')
  listProducts(@Query() query: unknown) {
    return this.catalog.listProducts(productListQuerySchema.parse(query));
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getBySlug(slug);
  }

  @Get('facets')
  getFacets(@Query() query: unknown) {
    const parsed = productListQuerySchema.partial().parse(query);
    return this.catalog.getFacets(parsed);
  }

  @Get('leagues')
  listLeagues() {
    return this.leagues.list();
  }

  @Get('teams')
  listTeams(@Query('leagueId') leagueId?: string) {
    return this.teams.list(leagueId);
  }

  @Get('seasons')
  listSeasons() {
    return this.seasons.list();
  }

  @Get('brands')
  listBrands() {
    return this.brands.list();
  }

  @Get('categories')
  listCategories() {
    return this.categories.list();
  }
}
