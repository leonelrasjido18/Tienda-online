import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

/**
 * Proveedores de envío disponibles. `manual` usa la tabla de tarifas por provincia
 * y funciona sin depender de nadie; `andreani` se enchufa detrás de la misma
 * interfaz cuando haya credenciales.
 */
export const SHIPPING_PROVIDERS = ['manual', 'andreani'] as const;
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
