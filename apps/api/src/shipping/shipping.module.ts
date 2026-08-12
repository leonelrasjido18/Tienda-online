import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env.validation';
import { AndreaniShippingProvider } from './andreani-shipping.provider';
import { CorreoArgentinoShippingProvider } from './correo-argentino-shipping.provider';
import { ManualShippingProvider } from './manual-shipping.provider';
import { ShippingController } from './shipping.controller';
import { ShippingService } from './shipping.service';
import { SHIPPING_PROVIDER } from './shipping-provider.interface';

@Module({
  controllers: [ShippingController],
  providers: [
    ManualShippingProvider,
    AndreaniShippingProvider,
    CorreoArgentinoShippingProvider,
    {
      // El proveedor activo se elige por variable de entorno: cambiar de tarifas
      // manuales a Andreani o Correo Argentino no toca una línea de código de negocio.
      provide: SHIPPING_PROVIDER,
      inject: [ConfigService, ManualShippingProvider, AndreaniShippingProvider, CorreoArgentinoShippingProvider],
      useFactory: (
        config: ConfigService<Env, true>,
        manual: ManualShippingProvider,
        andreani: AndreaniShippingProvider,
        correo: CorreoArgentinoShippingProvider,
      ) => {
        switch (config.get('SHIPPING_PROVIDER')) {
          case 'andreani':
            return andreani;
          case 'correo_argentino':
            return correo;
          default:
            return manual;
        }
      },
    },
    ShippingService,
  ],
  exports: [ShippingService],
})
export class ShippingModule {}
