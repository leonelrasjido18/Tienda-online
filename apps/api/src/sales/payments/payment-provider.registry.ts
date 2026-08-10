import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CardPaymentMethod, CheckoutPaymentMethod } from '@tienda/shared';

import type { Env } from '../../config/env.validation';
import { MercadoPagoService } from './mercadopago.service';
import type { PaymentProvider } from './payment-provider.interface';
import { UalaService } from './uala.service';

/**
 * Conoce todas las pasarelas y cuál está activa.
 *
 * La activa se define por configuración (`PAYMENT_PROVIDER`), así que cambiar de
 * Mercado Pago a Ualá —o volver— es una variable de entorno, no un deploy de
 * código. Las inactivas siguen registradas para poder seguir procesando los
 * webhooks de pagos viejos hechos con esa pasarela.
 */
@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: PaymentProvider[];

  constructor(
    private readonly config: ConfigService<Env, true>,
    mercadoPago: MercadoPagoService,
    uala: UalaService,
  ) {
    this.providers = [mercadoPago, uala];
  }

  byName(name: string): PaymentProvider | undefined {
    return this.providers.find((p) => p.name === name);
  }

  /** Pasarela de tarjeta activa, ya verificada como configurada. */
  active(): PaymentProvider {
    const name = this.config.get('PAYMENT_PROVIDER') as CardPaymentMethod;
    const provider = this.byName(name);
    if (!provider) {
      throw new BadRequestException(`La pasarela "${name}" no existe`);
    }
    if (!provider.isConfigured) {
      throw new BadRequestException(`${name} no está configurado en este ambiente`);
    }
    return provider;
  }

  /** Métodos que el storefront puede ofrecer hoy. */
  enabledMethods(): CheckoutPaymentMethod[] {
    const active = this.byName(this.config.get('PAYMENT_PROVIDER'));
    const methods: CheckoutPaymentMethod[] = [];
    if (active?.isConfigured) {
      methods.push(active.name);
    }
    // La transferencia siempre está disponible: no depende de ninguna pasarela.
    methods.push('bank_transfer');
    return methods;
  }
}
