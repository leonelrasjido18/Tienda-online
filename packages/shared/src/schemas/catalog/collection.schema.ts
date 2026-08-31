import { z } from 'zod';

import { imageUrlSchema, slugSchema } from './common.schema';

export const upsertCollectionSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  description: z.string().max(500).nullish(),
  imageUrl: imageUrlSchema.nullish(),
  position: z.number().int().min(0).optional(),
});
export type UpsertCollectionInput = z.infer<typeof upsertCollectionSchema>;

export const collectionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  position: z.number().int(),
  productCount: z.number().int().optional(),
});
export type CollectionDto = z.infer<typeof collectionSchema>;

/** Reemplaza el conjunto de productos de una colección (con su orden). */
export const setCollectionProductsSchema = z.object({
  productIds: z.array(z.string().uuid()),
});
export type SetCollectionProductsInput = z.infer<typeof setCollectionProductsSchema>;
