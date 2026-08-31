import { z } from 'zod';

import { imageUrlSchema, slugSchema } from './common.schema';

export const upsertTeamSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  leagueId: z.string().uuid(),
  crestUrl: imageUrlSchema.nullish(),
  position: z.number().int().default(0),
});

export type UpsertTeamInput = z.infer<typeof upsertTeamSchema>;

export const teamSchema = upsertTeamSchema.extend({
  id: z.string().uuid(),
});

export type TeamDto = z.infer<typeof teamSchema>;
