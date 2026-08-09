import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import { upsertBrandSchema, type UpsertBrandInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BrandsService } from './brands.service';

@Controller('admin/brands')
export class BrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  list() {
    return this.brands.list();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertBrandSchema))
  create(@Body() body: UpsertBrandInput) {
    return this.brands.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertBrandSchema))
  update(@Param('id') id: string, @Body() body: UpsertBrandInput) {
    return this.brands.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.brands.remove(id);
  }
}
