import { Body, Controller, Get, Patch, UsePipes } from '@nestjs/common';
import { updateStoreSettingsSchema, type UpdateStoreSettingsInput } from '@tienda/shared';

import { Roles } from '../../auth/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SettingsService } from './settings.service';

// La configuración de la tienda (porcentaje de seña, datos bancarios, contacto)
// define cómo entra la plata: la maneja sólo la dueña.
@Roles('OWNER')
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    const settings = await this.settings.get();
    const descuentos = SettingsService.toPaymentDiscounts(settings);
    // Se devuelve la forma anidada, la misma que consume el storefront: si el
    // panel leyera las columnas planas habria dos maneras de leer lo mismo.
    return { ...settings, bankTransferDiscount: descuentos.bank_transfer, cashDiscount: descuentos.cash };
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(updateStoreSettingsSchema))
  update(@Body() body: UpdateStoreSettingsInput) {
    return this.settings.update(body);
  }
}
