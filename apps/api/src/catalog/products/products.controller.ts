import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Patch,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  aiNameProductSchema,
  bulkUpdateVariantsSchema,
  replaceProductOptionsSchema,
  reorderProductImagesSchema,
  updateProductImageSchema,
  upsertProductSchema,
  upsertVariantSchema,
  type AiNameProductInput,
  type BulkUpdateVariantsInput,
  type ReplaceProductOptionsInput,
  type ReorderProductImagesInput,
  type UpdateProductImageInput,
  type UpsertProductInput,
  type UpsertVariantInput,
} from '@tienda/shared';
import { z } from 'zod';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UploadsService } from '../uploads/uploads.service';
import { ProductNamerService } from './product-namer.service';
import { ProductsService } from './products.service';
import { Roles } from '../../auth/decorators/roles.decorator';

const adminListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});

@Roles('OWNER', 'STAFF')
@Controller('admin/products')
export class ProductsController {
  constructor(
    private readonly products: ProductsService,
    private readonly uploads: UploadsService,
    private readonly namer: ProductNamerService,
  ) {}

  @Get()
  list(@Query() query: unknown) {
    const filters = adminListQuerySchema.parse(query);
    return this.products.listForAdmin(filters);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.products.getDetail(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(upsertProductSchema))
  create(@Body() body: UpsertProductInput) {
    return this.products.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(upsertProductSchema))
  update(@Param('id') id: string, @Body() body: UpsertProductInput) {
    return this.products.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.products.remove(id);
  }

  /** Sugiere un nombre para el producto analizando su foto con IA (no lo guarda). */
  @Post(':id/ai-name')
  @UsePipes(new ZodValidationPipe(aiNameProductSchema))
  aiName(@Param('id') id: string, @Body() body: AiNameProductInput) {
    return this.namer.suggestName(id, body.imageId);
  }

  @Put(':id/options')
  @UsePipes(new ZodValidationPipe(replaceProductOptionsSchema))
  replaceOptions(@Param('id') id: string, @Body() body: ReplaceProductOptionsInput) {
    return this.products.replaceOptions(id, body);
  }

  @Post(':id/variants/generate')
  generateVariants(@Param('id') id: string) {
    return this.products.generateVariants(id);
  }

  @Post(':id/variants/bulk')
  @UsePipes(new ZodValidationPipe(bulkUpdateVariantsSchema))
  bulkUpdateVariants(@Param('id') id: string, @Body() body: BulkUpdateVariantsInput) {
    return this.products.bulkUpdateVariants(id, body);
  }

  @Patch(':id/variants/:variantId')
  @UsePipes(new ZodValidationPipe(upsertVariantSchema.partial()))
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() body: Partial<UpsertVariantInput>,
  ) {
    return this.products.updateVariant(id, variantId, body);
  }

  @Delete(':id/variants/:variantId')
  removeVariant(@Param('id') id: string, @Param('variantId') variantId: string) {
    return this.products.removeVariant(id, variantId);
  }

  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadImage(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const { url } = await this.uploads.processAndStore(file, 'products');
    return this.products.attachImage(id, url, null);
  }

  @Patch(':id/images/:imageId')
  @UsePipes(new ZodValidationPipe(updateProductImageSchema))
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() body: UpdateProductImageInput,
  ) {
    return this.products.updateImage(id, imageId, body);
  }

  @Put(':id/images/reorder')
  @UsePipes(new ZodValidationPipe(reorderProductImagesSchema))
  reorderImages(@Param('id') id: string, @Body() body: ReorderProductImagesInput) {
    return this.products.reorderImages(id, body.imageIds);
  }

  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.products.removeImage(id, imageId);
  }
}
