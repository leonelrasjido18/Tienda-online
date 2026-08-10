import { Inject, Injectable } from '@nestjs/common';
import type { ShippingQuoteDto, UpsertShippingRateInput } from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import { SHIPPING_PROVIDER, type ShippingProvider, type ShippingQuoteRequest } from './shipping-provider.interface';

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
  ) {}

  /** Cotiza el envío de un pedido ya creado, leyendo su dirección y peso real. */
  async quoteForOrder(orderId: string): Promise<ShippingQuoteDto> {
    const order = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { include: { variant: true } } },
    });

    if (order.pickupInStore) {
      return { provider: this.provider.name, priceCents: 0, etaDays: null, fallbackReason: null };
    }

    const weightGrams = order.items.reduce(
      // 350 g es el peso típico de una camiseta: evita cotizar en 0 si falta el dato.
      (sum, item) => sum + (item.variant?.weightGrams ?? 350) * item.quantity,
      0,
    );

    const request: ShippingQuoteRequest = {
      province: order.shippingProvince,
      postalCode: order.shippingPostalCode,
      city: order.shippingCity,
      weightGrams,
      declaredValueCents: order.subtotalCents,
    };

    return this.provider.quote(request);
  }

  listRates() {
    return this.prisma.shippingRate.findMany({ orderBy: { province: 'asc' } });
  }

  upsertRate(input: UpsertShippingRateInput) {
    return this.prisma.shippingRate.upsert({
      where: { province: input.province },
      create: input,
      update: input,
    });
  }

  async removeRate(id: string) {
    await this.prisma.shippingRate.delete({ where: { id } });
    return { success: true };
  }
}
