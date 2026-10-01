import { z } from 'zod';

import { moneyCentsSchema } from './common.schema';

/**
 * Ajuste masivo de precios.
 *
 * Toca el precio de todo lo que entre en el alcance, así que está pensado para
 * no poder aplicarse a ciegas: el panel obliga a simular primero y la operación
 * queda registrada en `audit_logs` con el antes y el después.
 */
export const BULK_PRICE_MODES = ['percentage', 'amount'] as const;
export type BulkPriceMode = (typeof BULK_PRICE_MODES)[number];

/**
 * Redondeos ofrecidos, en centavos. Un aumento del 12% deja precios como
 * $47.432, que nadie quiere publicar.
 */
export const BULK_PRICE_ROUNDINGS = [0, 10_000, 50_000, 100_000] as const;

export const bulkPriceAdjustmentSchema = z
  .object({
    mode: z.enum(BULK_PRICE_MODES),
    /** Porcentaje (1 = 1%) o monto en centavos, según `mode`. Puede ser negativo para bajar. */
    value: z.number().int(),
    /** Redondeo del resultado, en centavos. 0 = sin redondear. */
    roundTo: z.number().int().nonnegative().default(0),
    /** Sin filtros entra todo el catálogo activo. */
    leagueId: z.string().uuid().nullish(),
    categoryId: z.string().uuid().nullish(),
    /** Piso de seguridad: ningún precio queda por debajo de esto. */
    minPriceCents: moneyCentsSchema.default(0),
  })
  .superRefine((v, ctx) => {
    if (v.value === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'El ajuste no puede ser cero' });
    }
    if (v.mode === 'percentage' && (v.value < -90 || v.value > 500)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'El porcentaje tiene que estar entre -90 y 500',
      });
    }
  });

export type BulkPriceAdjustmentInput = z.infer<typeof bulkPriceAdjustmentSchema>;

export const bulkPricePreviewSchema = z.object({
  variantesAfectadas: z.number().int(),
  productosAfectados: z.number().int(),
  ejemplos: z.array(
    z.object({
      producto: z.string(),
      sku: z.string(),
      antes: z.number().int(),
      despues: z.number().int(),
    }),
  ),
  totalAntes: z.number().int(),
  totalDespues: z.number().int(),
});
export type BulkPricePreviewDto = z.infer<typeof bulkPricePreviewSchema>;

/**
 * Precio resultante. Se aplica el ajuste, después el redondeo y por último el
 * piso; en ese orden, para que el piso no pueda quedar anulado por el redondeo.
 */
export function applyBulkPrice(precioCents: number, ajuste: BulkPriceAdjustmentInput): number {
  const bruto =
    ajuste.mode === 'percentage'
      ? precioCents + Math.round((precioCents * ajuste.value) / 100)
      : precioCents + ajuste.value;

  const redondeado =
    ajuste.roundTo > 0 ? Math.round(bruto / ajuste.roundTo) * ajuste.roundTo : bruto;

  return Math.max(ajuste.minPriceCents, redondeado, 0);
}
