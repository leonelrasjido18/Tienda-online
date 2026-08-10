import { Body, Controller, Delete, Get, Param, Put, UsePipes } from '@nestjs/common';
import { upsertShippingRateSchema, type UpsertShippingRateInput } from '@tienda/shared';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ShippingService } from './shipping.service';

@Controller('admin/shipping/rates')
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

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
