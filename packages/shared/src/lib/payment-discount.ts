import type { CheckoutPaymentMethod } from '../schemas/sales/order.schema';

/**
 * Descuento por medio de pago.
 *
 * Solo aplica a los medios sin pasarela (transferencia y efectivo): ahí la
 * tienda no paga comisión, y ese ahorro es el que se traslada al cliente.
 * Ofrecerlo con tarjeta sería regalar plata dos veces.
 */
export const PAYMENT_DISCOUNT_MODES = ['percentage', 'amount'] as const;
export type PaymentDiscountMode = (typeof PAYMENT_DISCOUNT_MODES)[number];

/** Medios que admiten descuento. Los de pasarela quedan afuera a propósito. */
export const DISCOUNTABLE_PAYMENT_METHODS = ['bank_transfer', 'cash'] as const;
export type DiscountablePaymentMethod = (typeof DISCOUNTABLE_PAYMENT_METHODS)[number];

export interface PaymentDiscountConfig {
  mode: PaymentDiscountMode;
  /** Porcentaje (10 = 10%) o monto en centavos, según `mode`. */
  value: number;
}

export type PaymentDiscountSettings = Record<DiscountablePaymentMethod, PaymentDiscountConfig>;

export function isDiscountableMethod(method: CheckoutPaymentMethod): method is DiscountablePaymentMethod {
  return (DISCOUNTABLE_PAYMENT_METHODS as readonly string[]).includes(method);
}

/**
 * Cuánto se descuenta de `baseCents` con esa configuración.
 *
 * Nunca supera la base: un descuento mal cargado no puede dejar un total
 * negativo, que es el mismo agujero que tenían los cupones.
 */
export function calculatePaymentDiscountCents(baseCents: number, config: PaymentDiscountConfig | null): number {
  if (!config || config.value <= 0 || baseCents <= 0) return 0;

  const bruto =
    config.mode === 'percentage' ? Math.round((baseCents * config.value) / 100) : config.value;

  return Math.min(Math.max(0, bruto), baseCents);
}

/** Precio final con el descuento aplicado. */
export function applyPaymentDiscount(baseCents: number, config: PaymentDiscountConfig | null): number {
  return baseCents - calculatePaymentDiscountCents(baseCents, config);
}

/**
 * Configuración del medio pedido, o null si no tiene descuento activo. Sirve
 * tanto para cobrar como para mostrar el precio promocional en la ficha.
 */
export function resolvePaymentDiscount(
  method: CheckoutPaymentMethod,
  settings: PaymentDiscountSettings,
): PaymentDiscountConfig | null {
  if (!isDiscountableMethod(method)) return null;
  const config = settings[method];
  return config && config.value > 0 ? config : null;
}

/**
 * El mejor descuento disponible, para anunciarlo en la ficha del producto
 * ("o $39.425 pagando por transferencia").
 */
export function bestPaymentDiscount(
  baseCents: number,
  settings: PaymentDiscountSettings,
): { method: DiscountablePaymentMethod; discountCents: number; finalCents: number } | null {
  let mejor: { method: DiscountablePaymentMethod; discountCents: number; finalCents: number } | null = null;

  for (const method of DISCOUNTABLE_PAYMENT_METHODS) {
    const descuento = calculatePaymentDiscountCents(baseCents, settings[method] ?? null);
    if (descuento > 0 && (!mejor || descuento > mejor.discountCents)) {
      mejor = { method, discountCents: descuento, finalCents: baseCents - descuento };
    }
  }

  return mejor;
}
