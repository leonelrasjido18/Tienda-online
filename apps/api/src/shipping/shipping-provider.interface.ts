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
  readonly name: 'manual' | 'andreani' | 'correo_argentino';
  quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto>;
  createLabel?(orderId: string, address: {
    street: string;
    number: string | null;
    floor: string | null;
    city: string;
    province: string;
    postalCode: string;
    contactName: string;
    contactPhone: string | null;
    contactEmail: string;
  }): Promise<{ trackingNumber: string; labelUrl: string }>;
  getTracking?(trackingNumber: string): Promise<{ status: string; events: Array<{ status: string; message: string; date: string }> }>;
}

export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');
