import { Body, Controller, Delete, Get, Param, Put, UsePipes } from '@nestjs/common';
import { upsertShippingRateSchema, type UpsertShippingRateInput } from '@tienda/shared';

import { Roles } from '../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ShippingService } from './shipping.service';

// Las tarifas de envío se le cobran al cliente: sólo las toca la dueña.
@Roles('OWNER')
@Controller('admin/shipping/rates')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  /** Precios realmente cobrados, para armar la tabla con datos propios. */
  @Get('observed')
  observed() {
    return this.shipping.observedRates();
  }

  @Get()
  list() {
    return this.shipping.listRates();
  }

  @Put()
  @UsePipes(new ZodValidationPipe(upsertShippingRateSchema))
  upsert(@Body() body: UpsertShippingRateInput) {
    return this.shipping.upsertRate(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.shipping.removeRate(id);
  }
}
