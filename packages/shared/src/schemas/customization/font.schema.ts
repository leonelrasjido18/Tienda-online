import { z } from 'zod';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Tiene que ser un color hexadecimal, ej: #FFFFFF');

export const upsertLeagueFontSchema = z.object({
  leagueId: z.string().uuid(),
  name: z.string().min(1).max(80),
  fontFileUrl: z.string().min(1),
  fillColor: hexColor.default('#FFFFFF'),
  strokeColor: hexColor.nullish(),
  strokeWidthPx: z.number().int().min(0).max(20).default(0),
  letterSpacingPx: z.number().int().min(-10).max(50).default(0),
});

export type UpsertLeagueFontInput = z.infer<typeof upsertLeagueFontSchema>;

export const leagueFontSchema = upsertLeagueFontSchema.extend({
  id: z.string().uuid(),
});

export type LeagueFontDto = z.infer<typeof leagueFontSchema>;
