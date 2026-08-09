import { z } from 'zod';

import { slugSchema } from './common.schema';

export const upsertCategorySchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  parentId: z.string().uuid().nullish(),
  imageUrl: z.string().url().nullish(),
  position: z.number().int().default(0),
});

export type UpsertCategoryInput = z.infer<typeof upsertCategorySchema>;

export const categorySchema = upsertCategorySchema.extend({
  id: z.string().uuid(),
});

export type CategoryDto = z.infer<typeof categorySchema>;
