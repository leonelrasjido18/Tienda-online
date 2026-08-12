import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

/**
 * Proveedores de envío disponibles. `manual` usa la tabla de tarifas por provincia
 * y funciona sin depender de nadie; `andreani` y `correo_argentino` se enchufan
 * detrás de la misma interfaz cuando haya credenciales.
 */
export const SHIPPING_PROVIDERS = ['manual', 'andreani', 'correo_argentino'] as const;
export type ShippingProviderName = (typeof SHIPPING_PROVIDERS)[number];

export const upsertShippingRateSchema = z.object({
  province: z.string().trim().min(2).max(120),
  priceCents: moneyCentsSchema,
  etaDays: z.number().int().min(0).max(120).nullish(),
  isActive: z.boolean().default(true),
});
export type UpsertShippingRateInput = z.infer<typeof upsertShippingRateSchema>;

export const shippingRateSchema = z.object({
  id: z.string().uuid(),
  province: z.string(),
  priceCents: z.number().int(),
  etaDays: z.number().int().nullable(),
  isActive: z.boolean(),
});
export type ShippingRateDto = z.infer<typeof shippingRateSchema>;

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
