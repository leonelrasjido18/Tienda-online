import { z } from 'zod';

import { PRODUCT_STATUSES } from './product.schema';

/**
 * Edición masiva de productos.
 *
 * Toca muchos productos de una, así que sigue el mismo patrón que el ajuste de
 * precios: se simula primero y la operación queda registrada en `audit_logs`.
 */
export const bulkEditFilterSchema = z.object({
  /** Sin filtros entra todo el catálogo. */
  status: z.enum(PRODUCT_STATUSES).nullish(),
  leagueId: z.string().uuid().nullish(),
  teamId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  /** Coincidencia parcial en el nombre. */
  q: z.string().trim().max(100).nullish(),
  /** Para encontrar lo que quedó a medio cargar. */
  sinLiga: z.boolean().nullish(),
  sinEquipo: z.boolean().nullish(),
  sinFoto: z.boolean().nullish(),
});
export type BulkEditFilter = z.infer<typeof bulkEditFilterSchema>;

export const bulkEditChangesSchema = z.object({
  status: z.enum(PRODUCT_STATUSES).nullish(),
  leagueId: z.string().uuid().nullish(),
  teamId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  seasonId: z.string().uuid().nullish(),
  fulfillmentMode: z.enum(['PREORDER', 'IN_STOCK', 'BOTH']).nullish(),
});
export type BulkEditChanges = z.infer<typeof bulkEditChangesSchema>;

export const bulkEditSchema = z
  .object({
    filtro: bulkEditFilterSchema,
    cambios: bulkEditChangesSchema,
  })
  .superRefine((v, ctx) => {
    const algunCambio = Object.values(v.cambios).some((x) => x !== undefined && x !== null);
    if (!algunCambio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cambios'],
        message: 'Hay que indicar al menos un cambio',
      });
    }
  });
export type BulkEditInput = z.infer<typeof bulkEditSchema>;

export const bulkEditPreviewSchema = z.object({
  afectados: z.number().int(),
  ejemplos: z.array(z.object({ id: z.string(), name: z.string() })),
});
export type BulkEditPreviewDto = z.infer<typeof bulkEditPreviewSchema>;
