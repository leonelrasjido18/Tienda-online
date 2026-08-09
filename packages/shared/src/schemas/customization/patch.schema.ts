import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

export const upsertPatchSchema = z.object({
  name: z.string().min(1).max(80),
  imageUrl: z.string().min(1),
  priceCents: moneyCentsSchema,
  leagueIds: z.array(z.string().uuid()).default([]),
});

export type UpsertPatchInput = z.infer<typeof upsertPatchSchema>;

export const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  imageUrl: z.string(),
  priceCents: z.number().int(),
  leagueIds: z.array(z.string().uuid()),
});

export type PatchDto = z.infer<typeof patchSchema>;
