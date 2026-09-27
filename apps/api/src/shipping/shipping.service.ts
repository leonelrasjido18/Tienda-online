import { Inject, Injectable } from '@nestjs/common';
import type { ObservedShippingRateDto, ShippingQuoteDto, UpsertShippingRateInput } from '@tienda/shared';

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

  /**
   * Cotización en vivo para el checkout: por CP de destino + el carrito actual
   * (peso y valor declarado calculados server-side, nunca desde el cliente).
   */
  async quoteForCart(
    sessionToken: string | undefined,
    addr: { postalCode: string; province: string | null; city: string | null },
  ): Promise<ShippingQuoteDto> {
    const cart = sessionToken ? await this.prisma.cart.findUnique({ where: { sessionToken } }) : null;

    // 350 g es el peso típico de una camiseta: sirve de piso si falta el dato.
    let weightGrams = 350;
    let declaredValueCents = 0;
    if (cart && cart.expiresAt >= new Date()) {
      const items = await this.prisma.cartItem.findMany({
        where: { cartId: cart.id },
        include: { variant: true },
      });
      const w = items.reduce((sum, item) => sum + (item.variant?.weightGrams ?? 350) * item.quantity, 0);
      weightGrams = w || 350;
      declaredValueCents = items.reduce((sum, item) => sum + item.priceCentsAtAdd * item.quantity, 0);
    }

    return this.provider.quote({
      province: addr.province,
      postalCode: addr.postalCode,
      city: addr.city,
      weightGrams,
      declaredValueCents,
    });
  }

  listRates() {
    return this.prisma.shippingRate.findMany({ orderBy: { province: 'asc' } });
  }

  /**
   * Lo que de verdad se cobro de envio, agrupado por provincia.
   *
   * No hay tabla aparte: cada pedido ya guarda su provincia y el envio que se le
   * cobro, asi que las observaciones son los propios pedidos despachados. Cada
   * vez que se carga un envio a mano (cotizado en el sitio del correo) este
   * promedio se afina solo.
   *
   * Se excluyen los de retiro en local y los de envio $0 (cupon de envio gratis
   * o provincia sin tarifa): meterlos hundiria el promedio con precios que
   * nunca se cobraron.
   */
  async observedRates(): Promise<ObservedShippingRateDto[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        pickupInStore: false,
        shippingCents: { gt: 0 },
        shippingProvince: { not: null },
      },
      select: {
        shippingProvince: true,
        shippingCents: true,
        updatedAt: true,
        _count: { select: { items: true } },
      },
    });

    const porProvincia = new Map<
      string,
      { montos: number[]; items: number[]; last: Date }
    >();
    for (const order of orders) {
      const provincia = order.shippingProvince!;
      const actual = porProvincia.get(provincia) ?? { montos: [], items: [], last: order.updatedAt };
      actual.montos.push(order.shippingCents!);
      actual.items.push(order._count.items);
      if (order.updatedAt > actual.last) actual.last = order.updatedAt;
      porProvincia.set(provincia, actual);
    }

    return [...porProvincia.entries()]
      .map(([province, { montos, items, last }]) => ({
        province,
        samples: montos.length,
        avgCents: Math.round(montos.reduce((a, b) => a + b, 0) / montos.length),
        minCents: Math.min(...montos),
        maxCents: Math.max(...montos),
        avgItems: Number((items.reduce((a, b) => a + b, 0) / items.length).toFixed(1)),
        lastAt: last.toISOString(),
      }))
      .sort((a, b) => a.province.localeCompare(b.province));
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
