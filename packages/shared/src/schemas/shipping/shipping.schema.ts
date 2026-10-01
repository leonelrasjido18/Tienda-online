import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

/**
 * Proveedores de envío disponibles. `manual` usa la tabla de tarifas por provincia
 * y funciona sin depender de nadie; `andreani` y `correo_argentino` se enchufan
 * detrás de la misma interfaz cuando haya credenciales.
 */
export const SHIPPING_PROVIDERS = ['manual', 'andreani', 'correo_argentino'] as const;
export type ShippingProviderName = (typeof SHIPPING_PROVIDERS)[number];

/**
 * Código postal de una tarifa. Vacío significa "toda la provincia", que es la
 * red de seguridad; con un código cargado, esa localidad sale distinto.
 * Se acepta tanto `1425` como el CPA `C1425ABC`: `pickShippingRate` normaliza.
 */
const ratePostalCodeSchema = z
  .string()
  .trim()
  .max(8)
  .default('')
  .refine((v) => v === '' || /^\d{4}$/.test(v) || /^[A-Za-z]\d{4}[A-Za-z]{3}$/.test(v), {
    message: 'Poné un código postal de 4 dígitos (1425) o el CPA completo (C1425ABC)',
  });

export const upsertShippingRateSchema = z.object({
  province: z.string().trim().min(2).max(120),
  postalCode: ratePostalCodeSchema,
  priceCents: moneyCentsSchema,
  etaDays: z.number().int().min(0).max(120).nullish(),
  isActive: z.boolean().default(true),
});
export type UpsertShippingRateInput = z.infer<typeof upsertShippingRateSchema>;

/**
 * Carga de muchos códigos postales de una. Sin esto, cargar las tarifas de una
 * provincia con excepciones por localidad es un formulario por fila.
 */
export const bulkShippingRatesSchema = z.object({
  province: z.string().trim().min(2).max(120),
  rates: z
    .array(
      z.object({
        postalCode: ratePostalCodeSchema,
        priceCents: moneyCentsSchema,
        etaDays: z.number().int().min(0).max(120).nullish(),
      }),
    )
    .min(1)
    .max(500),
});
export type BulkShippingRatesInput = z.infer<typeof bulkShippingRatesSchema>;

export const shippingRateSchema = z.object({
  id: z.string().uuid(),
  province: z.string(),
  postalCode: z.string(),
  priceCents: z.number().int(),
  etaDays: z.number().int().nullable(),
  isActive: z.boolean(),
});
export type ShippingRateDto = z.infer<typeof shippingRateSchema>;

/**
 * Lo que realmente se cobro de envio por provincia, sacado de los pedidos ya
 * despachados. Sirve para construir la tabla de tarifas con precios propios en
 * vez de adivinar: cada envio cotizado a mano en el sitio del correo queda como
 * observacion.
 */
export const observedShippingRateSchema = z.object({
  province: z.string(),
  /** Cantidad de envios que respaldan el promedio. */
  samples: z.number().int(),
  avgCents: z.number().int(),
  minCents: z.number().int(),
  maxCents: z.number().int(),
  /** Prendas promedio por pedido: el precio del correo sube con el peso. */
  avgItems: z.number(),
  lastAt: z.string(),
});
export type ObservedShippingRateDto = z.infer<typeof observedShippingRateSchema>;

/** Cuerpo de la cotización en vivo del checkout: el CP de destino (y provincia). */
export const publicShippingQuoteSchema = z.object({
  postalCode: z.string().trim().min(4).max(8),
  province: z.string().trim().max(120).nullish(),
  city: z.string().trim().max(120).nullish(),
});
export type PublicShippingQuoteInput = z.infer<typeof publicShippingQuoteSchema>;

/** Resultado de cotizar un envío, sea cual sea el proveedor. */
export const shippingQuoteSchema = z.object({
  provider: z.enum(SHIPPING_PROVIDERS),
  priceCents: z.number().int(),
  etaDays: z.number().int().nullable(),
  /** Motivo cuando no se pudo cotizar y se usó un valor por defecto. */
  fallbackReason: z.string().nullable(),
});
export type ShippingQuoteDto = z.infer<typeof shippingQuoteSchema>;

/** Provincias argentinas, para precargar la tabla de tarifas en el panel. */
export const AR_PROVINCES = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
 ] as const;

export const SHIPMENT_STATUSES = ['PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const shipmentDtoSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  provider: z.string(),
  trackingNumber: z.string(),
  labelUrl: z.string().url().nullable(),
  status: z.enum(SHIPMENT_STATUSES),
  shippedAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ShipmentDto = z.infer<typeof shipmentDtoSchema>;

export const createShipmentSchema = z.object({
  provider: z.string().min(1).max(50),
  trackingNumber: z.string().min(1).max(100),
  labelUrl: z.string().url().max(500).optional().nullable(),
});
export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const updateShipmentSchema = z.object({
  status: z.enum(SHIPMENT_STATUSES),
  trackingNumber: z.string().min(1).max(100).optional(),
  deliveredAt: z.string().datetime().optional().nullable(),
});
export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;
