import { Body, Controller, Delete, Get, Param, Put, UsePipes } from '@nestjs/common';
import { upsertCustomizationTemplateSchema, type UpsertCustomizationTemplateInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TemplatesService } from './templates.service';

@Controller('admin/products/:productId/customization')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

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
}
