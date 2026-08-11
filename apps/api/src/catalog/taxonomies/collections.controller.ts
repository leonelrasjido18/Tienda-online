import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import {
  setCollectionProductsSchema,
  upsertCollectionSchema,
  type SetCollectionProductsInput,
  type UpsertCollectionInput,
} from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CollectionsService } from './collections.service';

@Roles('OWNER', 'STAFF')
@Controller('admin/collections')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list() {
    return this.collections.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.collections.get(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertCollectionSchema))
  create(@Body() body: UpsertCollectionInput) {
    return this.collections.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertCollectionSchema))
  update(@Param('id') id: string, @Body() body: UpsertCollectionInput) {
    return this.collections.update(id, body);
  }

  @Put(':id/products')
  @UsePipes(new ZodValidationPipe(setCollectionProductsSchema))
  setProducts(@Param('id') id: string, @Body() body: SetCollectionProductsInput) {
    return this.collections.setProducts(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.collections.remove(id);
  }
}
