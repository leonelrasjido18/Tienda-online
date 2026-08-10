import { Body, Controller, Get, Patch, UsePipes } from '@nestjs/common';
import { updateStoreSettingsSchema, type UpdateStoreSettingsInput } from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SettingsService } from './settings.service';

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
