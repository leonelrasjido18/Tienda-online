import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import { upsertLeagueSchema, type UpsertLeagueInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { LeaguesService } from './leagues.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/leagues')
export class LeaguesController {
  constructor(private readonly leagues: LeaguesService) {}

  @Get()
  list() {
    return this.leagues.list();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertLeagueSchema))
  create(@Body() body: UpsertLeagueInput) {
    return this.leagues.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertLeagueSchema))
  update(@Param('id') id: string, @Body() body: UpsertLeagueInput) {
    return this.leagues.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.leagues.remove(id);
  }
}
