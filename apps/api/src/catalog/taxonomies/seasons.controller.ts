import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import { upsertSeasonSchema, type UpsertSeasonInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SeasonsService } from './seasons.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/seasons')
export class SeasonsController {
  constructor(private readonly seasons: SeasonsService) {}

  @Get()
  list() {
    return this.seasons.list();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertSeasonSchema))
  create(@Body() body: UpsertSeasonInput) {
    return this.seasons.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertSeasonSchema))
  update(@Param('id') id: string, @Body() body: UpsertSeasonInput) {
    return this.seasons.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.seasons.remove(id);
  }
}
