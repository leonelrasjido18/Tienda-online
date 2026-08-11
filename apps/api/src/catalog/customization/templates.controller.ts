import { Body, Controller, Delete, Get, Param, Post, Put, UsePipes } from '@nestjs/common';
import {
  analyzeCustomizationSchema,
  upsertCustomizationTemplateSchema,
  type AnalyzeCustomizationInput,
  type UpsertCustomizationTemplateInput,
} from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AnalyzerService } from './analyzer.service';
import { TemplatesService } from './templates.service';
import { Roles } from '../../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/products/:productId/customization')
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly analyzer: AnalyzerService,
  ) {}

  @Get()
  get(@Param('productId') productId: string) {
    return this.templates.get(productId);
  }

  @Put()
  @UsePipes(new ZodValidationPipe(upsertCustomizationTemplateSchema))
  upsert(@Param('productId') productId: string, @Body() body: UpsertCustomizationTemplateInput) {
    return this.templates.upsert(productId, body);
  }

  @Delete()
  remove(@Param('productId') productId: string) {
    return this.templates.remove(productId);
  }

  /** Analiza una foto del producto con IA y sugiere los campos de personalización. */
  @Post('analyze')
  @UsePipes(new ZodValidationPipe(analyzeCustomizationSchema))
  analyze(@Param('productId') productId: string, @Body() body: AnalyzeCustomizationInput) {
    return this.analyzer.analyzeProductImage(productId, body.imageId);
  }
}
