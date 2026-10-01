import { Inject, Injectable } from '@nestjs/common';
import {
  normalizePostalCode,
  type BulkShippingRatesInput,
  type ObservedShippingRateDto,
  type ShippingQuoteDto,
  type UpsertShippingRateInput,
} from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import { SHIPPING_PROVIDER, type ShippingProvider, type ShippingQuoteRequest } from './shipping-provider.interface';

/** Peso tipico de una camiseta. Sirve de piso cuando la variante no lo tiene cargado. */
const PESO_CAMISETA_GRAMOS = 350;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SHIPPING_PROVIDER) private readonly provider: ShippingProvider,
  ) {}

  /**
   * Cotiza a partir de las líneas ya resueltas, sin volver a leer el carrito.
   *
   * La usa el checkout, que en ese punto ya tiene los ítems validados dentro de
   * su transacción: volver a consultar el carrito ahí abriría una ventana para
   * que el peso cotizado no sea el del pedido que se está creando.
   */
  quoteForItems(
    addr: { postalCode: string | null; province: string | null; city: string | null },
    items: Array<{ quantity: number; priceCents: number; weightGrams: number | null }>,
  ): Promise<ShippingQuoteDto> {
    const weightGrams =
      items.reduce((sum, i) => sum + (i.weightGrams ?? PESO_CAMISETA_GRAMOS) * i.quantity, 0) ||
      PESO_CAMISETA_GRAMOS;

    return this.provider.quote({
      province: addr.province,
      postalCode: addr.postalCode,
      city: addr.city,
      weightGrams,
      declaredValueCents: items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0),
    });
  }

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
      (sum, item) => sum + (item.variant?.weightGrams ?? PESO_CAMISETA_GRAMOS) * item.quantity,
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
      const w = items.reduce((sum, item) => sum + (item.variant?.weightGrams ?? PESO_CAMISETA_GRAMOS) * item.quantity, 0);
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
    return this.prisma.shippingRate.findMany({ orderBy: [{ province: 'asc' }, { postalCode: 'asc' }] });
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

  /** Una tarifa por (provincia, codigo postal). Sin codigo postal es la de toda la provincia. */
  upsertRate(input: UpsertShippingRateInput) {
    const postalCode = normalizePostalCode(input.postalCode) ?? '';
    const datos = { ...input, postalCode };
    return this.prisma.shippingRate.upsert({
      where: { province_postalCode: { province: input.province, postalCode } },
      create: datos,
      update: datos,
    });
  }

  /**
   * Carga de varios codigos postales de una sola provincia en una pasada.
   *
   * Es una transaccion para que no quede a medio cargar: con 200 filas pegadas
   * desde una planilla, la mitad aplicada es peor que ninguna.
   */
  async upsertRatesBulk(input: BulkShippingRatesInput) {
    const normalizadas = input.rates.map((r) => ({
      province: input.province,
      postalCode: normalizePostalCode(r.postalCode) ?? '',
      priceCents: r.priceCents,
      etaDays: r.etaDays ?? null,
      isActive: true,
    }));

    // Si viene dos veces el mismo codigo postal, sobrevive el ultimo: dentro de
    // una transaccion dos upserts a la misma clave se pisan igual, pero asi el
    // numero que se informa es el de filas que realmente quedaron.
    const porClave = new Map(normalizadas.map((r) => [r.postalCode, r]));
    const filas = [...porClave.values()];

    await this.prisma.$transaction(
      filas.map((r) =>
        this.prisma.shippingRate.upsert({
          where: { province_postalCode: { province: r.province, postalCode: r.postalCode } },
          create: r,
          update: { priceCents: r.priceCents, etaDays: r.etaDays, isActive: true },
        }),
      ),
    );

    return { cargadas: filas.length, repetidas: normalizadas.length - filas.length };
  }

  async removeRate(id: string) {
    await this.prisma.shippingRate.delete({ where: { id } });
    return { success: true };
  }
}
