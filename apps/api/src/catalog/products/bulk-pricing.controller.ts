import { Body, Controller, Get, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { bulkPriceAdjustmentSchema, type BulkPriceAdjustmentInput } from '@tienda/shared';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BulkPricingService } from './bulk-pricing.service';

/**
 * Ajuste masivo de precios. Cambia el precio de todo el catálogo que entre en
 * el alcance, así que queda reservado a la dueña.
 */
@Roles('OWNER')
@Controller('admin/pricing')
export class BulkPricingController {
  constructor(private readonly pricing: BulkPricingService) {}

  /** Simulación: no escribe nada. */
  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(bulkPriceAdjustmentSchema))
  preview(@Body() body: BulkPriceAdjustmentInput) {
    return this.pricing.preview(body);
  }

  @Post('apply')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(bulkPriceAdjustmentSchema))
  apply(@Body() body: BulkPriceAdjustmentInput, @CurrentUser() user: AuthenticatedUser) {
    return this.pricing.apply(body, user?.id ?? null);
  }

  /** Precios reales del catálogo, para las previsualizaciones del panel. */
  @Get('sample-prices')
  samplePrices() {
    return this.pricing.samplePrices();
  }

  @Get('history')
  history() {
    return this.pricing.history();
  }
}
