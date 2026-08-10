import type { ShippingQuoteDto } from '@tienda/shared';

/** Datos mínimos que necesita cualquier proveedor para cotizar un envío. */
export interface ShippingQuoteRequest {
  province: string | null;
  postalCode: string | null;
  city: string | null;
  /** Peso total del pedido en gramos, sumando las variantes. */
  weightGrams: number;
  /** Valor declarado, que algunos correos usan para el seguro. */
  declaredValueCents: number;
}

/**
 * Contrato único de envíos. Todo lo que cotiza pasa por acá, así cambiar de
 * proveedor es cambiar la implementación registrada y nada más.
 */
export interface ShippingProvider {
  readonly name: 'manual' | 'andreani';
  quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto>;
}

export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');
