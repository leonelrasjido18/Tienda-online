import { z } from 'zod';

import { slugSchema } from './common.schema';

export const upsertLeagueSchema = z.object({
  name: z.string().min(1).max(120),
  slug: slugSchema,
  logoUrl: z.string().url().nullish(),
  position: z.number().int().default(0),
});

export type UpsertLeagueInput = z.infer<typeof upsertLeagueSchema>;

export const leagueSchema = upsertLeagueSchema.extend({
  id: z.string().uuid(),
});

export type LeagueDto = z.infer<typeof leagueSchema>;
