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

    // El storefront sólo ofrece lo que está configurado (pasarela con credenciales)
    // Y activado por la dueña desde Ajustes → Cobros.
    const configured = this.payments.enabledMethods();
    const methods: string[] = [];
    for (const method of configured) {
      if (method === 'bank_transfer') {
        if (settings.enableBankTransfer) methods.push(method);
      } else if (settings.enableCardPayment) {
        methods.push(method);
      }
    }
    if (settings.enableCash) methods.push('cash');

    return {
      defaultDepositPercent: settings.defaultDepositPercent,
      bankTransferInstructions: settings.bankTransferInstructions,
      enabledPaymentMethods: methods,
    };
  }
}
