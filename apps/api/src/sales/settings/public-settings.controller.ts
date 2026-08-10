import { Controller, Get } from '@nestjs/common';
import type { PublicStoreSettingsDto } from '@tienda/shared';

import { Public } from '../../auth/decorators/public.decorator';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { SettingsService } from './settings.service';

@Public()
@Controller('settings')
export class PublicSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly payments: PaymentProviderRegistry,
  ) {}

  @Get()
  async get(): Promise<PublicStoreSettingsDto & { bankTransferInstructions: string | null }> {
    const settings = await this.settings.get();
    return {
      defaultDepositPercent: settings.defaultDepositPercent,
      bankTransferInstructions: settings.bankTransferInstructions,
      // El storefront sólo debe ofrecer lo que realmente está configurado.
      enabledPaymentMethods: this.payments.enabledMethods(),
    };
  }
}
