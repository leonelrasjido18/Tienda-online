import { z } from 'zod';

/** Cuerpo opcional: qué foto usar para nombrar (por defecto, la principal). */
export const aiNameProductSchema = z.object({
  imageId: z.string().uuid().optional(),
});
export type AiNameProductInput = z.infer<typeof aiNameProductSchema>;

/** Tipos de camiseta que la IA puede reconocer. */
export const PRODUCT_KIND_VALUES = [
  'local',
  'visitante',
  'tercera',
  'cuarta',
  'arquero',
  'entrenamiento',
  'retro',
  'edicion_especial',
  'otro',
] as const;
export type ProductKind = (typeof PRODUCT_KIND_VALUES)[number];

/**
 * Sugerencia de nombre devuelta por la IA. Se valida contra esto tanto lo que
 * responde el modelo como lo que sale por la API.
 */
export const productNameSuggestionSchema = z.object({
  team: z.string().max(80),
  kind: z.enum(PRODUCT_KIND_VALUES),
  season: z.string().max(20).nullable(),
  confidence: z.enum(['alta', 'media', 'baja']),
  name: z.string().min(3).max(140),
});
export type ProductNameSuggestion = z.infer<typeof productNameSuggestionSchema>;
