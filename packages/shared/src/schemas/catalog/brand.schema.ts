import { z } from 'zod';

import { slugSchema } from './common.schema';

export const upsertBrandSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  logoUrl: z.string().url().nullish(),
});

export type UpsertBrandInput = z.infer<typeof upsertBrandSchema>;

export const brandSchema = upsertBrandSchema.extend({
  id: z.string().uuid(),
});

export type BrandDto = z.infer<typeof brandSchema>;
