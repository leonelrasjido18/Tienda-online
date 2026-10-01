import { Injectable, Logger } from '@nestjs/common';
import { normalizePostalCode, pickShippingRate, type ShippingQuoteDto } from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import type { ShippingProvider, ShippingQuoteRequest } from './shipping-provider.interface';

/** Se usa cuando la provincia no tiene tarifa cargada, para no bloquear el cobro del saldo. */
const FALLBACK_PRICE_CENTS = 0;

/**
 * Cotización por la tabla de tarifas cargada desde el panel: por provincia, y
 * por código postal cuando una localidad sale distinto que el resto.
 * Es el proveedor por defecto: no depende de ninguna API externa, así que la
 * tienda puede cobrar el saldo aunque el correo esté caído o sin credenciales.
 */
@Injectable()
export class ManualShippingProvider implements ShippingProvider {
  readonly name = 'manual' as const;
  private readonly logger = new Logger(ManualShippingProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto> {
    if (!request.province && !request.postalCode) {
      return {
        provider: 'manual',
        priceCents: FALLBACK_PRICE_CENTS,
        etaDays: null,
        fallbackReason: 'El pedido no tiene provincia ni código postal',
      };
    }

    // Se traen las candidatas y decide `pickShippingRate`, que es puro y está
    // probado. Filtrar acá en SQL obligaría a normalizar códigos postales en la
    // base (el CPA "C1425ABC" y "1425" son el mismo destino) y la regla de qué
    // tarifa gana quedaría escrita en dos lugares.
    const cp = normalizePostalCode(request.postalCode);
    const candidatas = await this.prisma.shippingRate.findMany({
      where: {
        isActive: true,
        OR: [
          ...(request.province
            ? [{ postalCode: '', province: { equals: request.province, mode: 'insensitive' as const } }]
            : []),
          ...(cp ? [{ postalCode: { not: '' } }] : []),
        ],
      },
    });

    const rate = pickShippingRate(candidatas, {
      postalCode: request.postalCode,
      province: request.province,
    });

    if (!rate) {
      const destino = request.postalCode ?? request.province ?? 'destino desconocido';
      this.logger.warn(`Sin tarifa para "${destino}": queda en 0 para ajustar a mano`);
      return {
        provider: 'manual',
        priceCents: FALLBACK_PRICE_CENTS,
        etaDays: null,
        fallbackReason: `No hay tarifa cargada para ${destino}`,
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
