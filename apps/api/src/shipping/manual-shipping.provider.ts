import { Injectable, Logger } from '@nestjs/common';
import type { ShippingQuoteDto } from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import type { ShippingProvider, ShippingQuoteRequest } from './shipping-provider.interface';

/** Se usa cuando la provincia no tiene tarifa cargada, para no bloquear el cobro del saldo. */
const FALLBACK_PRICE_CENTS = 0;

/**
 * Cotización por tabla de tarifas por provincia, cargada desde el panel.
 * Es el proveedor por defecto: no depende de ninguna API externa, así que la
 * tienda puede cobrar el saldo aunque el correo esté caído o sin credenciales.
 */
@Injectable()
export class ManualShippingProvider implements ShippingProvider {
  readonly name = 'manual' as const;
  private readonly logger = new Logger(ManualShippingProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto> {
    if (!request.province) {
      return {
        provider: 'manual',
        priceCents: FALLBACK_PRICE_CENTS,
        etaDays: null,
        fallbackReason: 'El pedido no tiene provincia cargada',
      };
    }

    const rate = await this.prisma.shippingRate.findFirst({
      where: { province: { equals: request.province, mode: 'insensitive' }, isActive: true },
    });

    if (!rate) {
      this.logger.warn(`Sin tarifa para "${request.province}": queda en 0 para ajustar a mano`);
      return {
        provider: 'manual',
        priceCents: FALLBACK_PRICE_CENTS,
        etaDays: null,
        fallbackReason: `No hay tarifa cargada para ${request.province}`,
      };
    }

    return {
      provider: 'manual',
      priceCents: rate.priceCents,
      etaDays: rate.etaDays,
      fallbackReason: null,
    };
  }
}
