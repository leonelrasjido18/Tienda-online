import { Body, Controller, Delete, Get, Param, Post, Put, Query, UsePipes } from '@nestjs/common';
import { upsertTeamSchema, type UpsertTeamInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TeamsService } from './teams.service';

@Controller('admin/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(@Query('leagueId') leagueId?: string) {
    return this.teams.list(leagueId);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertTeamSchema))
  create(@Body() body: UpsertTeamInput) {
    return this.teams.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertTeamSchema))
  update(@Param('id') id: string, @Body() body: UpsertTeamInput) {
    return this.teams.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.teams.remove(id);
  }
}
