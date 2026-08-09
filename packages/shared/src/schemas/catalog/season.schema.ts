import { z } from 'zod';

export const upsertSeasonSchema = z.object({
  label: z.string().min(1).max(60),
  position: z.number().int().default(0),
});

export type UpsertSeasonInput = z.infer<typeof upsertSeasonSchema>;

export const seasonSchema = upsertSeasonSchema.extend({
  id: z.string().uuid(),
});

export type SeasonDto = z.infer<typeof seasonSchema>;
