import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.validation';
import { AndreaniShippingProvider } from './andreani-shipping.provider';
import { ManualShippingProvider } from './manual-shipping.provider';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SHIPPING_PROVIDER } from './shipping-provider.interface';

@Module({
  controllers: [ShippingController],
  providers: [
    ManualShippingProvider,
    AndreaniShippingProvider,
    {
      // El proveedor activo se elige por variable de entorno: cambiar de tarifas
      // manuales a Andreani no toca una línea de código de negocio.
      provide: SHIPPING_PROVIDER,
      inject: [ConfigService, ManualShippingProvider, AndreaniShippingProvider],
      useFactory: (config: ConfigService<Env, true>, manual: ManualShippingProvider, andreani: AndreaniShippingProvider) =>
        config.get('SHIPPING_PROVIDER') === 'andreani' ? andreani : manual,
    },
    ShippingService,
  ],
  exports: [ShippingService],
})
export class ShippingModule {}
