import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import { upsertCategorySchema, type UpsertCategoryInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CategoriesService } from './categories.service';

@Controller('admin/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list() {
    return this.categories.list();
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertCategorySchema))
  create(@Body() body: UpsertCategoryInput) {
    return this.categories.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertCategorySchema))
  update(@Param('id') id: string, @Body() body: UpsertCategoryInput) {
    return this.categories.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categories.remove(id);
  }
}
