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
  get() {
    return this.settings.get();
  }

  @Patch()
  @UsePipes(new ZodValidationPipe(updateStoreSettingsSchema))
  update(@Body() body: UpdateStoreSettingsInput) {
    return this.settings.update(body);
  }
}
