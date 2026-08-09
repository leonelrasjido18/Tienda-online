import { z } from 'zod';

const NAME_PATTERN = /^[A-Za-zÀ-ÿ0-9 ]*$/;

// Lista mínima de arranque para bloquear insultos obvios; se puede ampliar sin tocar
// la forma del schema.
const BLOCKED_WORDS = ['puto', 'puta', 'boludo', 'pelotudo', 'idiota', 'estupido', 'mierda', 'forro'];

export function containsBlockedWord(text: string): boolean {
  const normalized = text.toLowerCase();
  return BLOCKED_WORDS.some((word) => normalized.includes(word));
}

/** Validación estructural laxa, usada en el borde de la API antes de conocer los límites del producto. */
export const customizationInputSchema = z.object({
  playerName: z.string().trim().max(60).regex(NAME_PATTERN, 'Sólo letras, números y espacios').optional(),
  playerNumber: z.coerce.number().int().min(0).max(999).optional(),
  fontId: z.string().uuid().nullish(),
  patchIds: z.array(z.string().uuid()).default([]),
});

export type CustomizationInput = z.infer<typeof customizationInputSchema>;

export interface CustomizationLimits {
  maxNameLength: number;
  minNumber: number;
  maxNumber: number;
}

/** Schema con los límites reales del producto (largo de nombre, rango de dorsal) + filtro de palabras. */
export function buildCustomizationInputSchema(limits: CustomizationLimits) {
  return z.object({
    playerName: z
      .string()
      .trim()
      .max(limits.maxNameLength, `El nombre no puede tener más de ${limits.maxNameLength} caracteres`)
      .regex(NAME_PATTERN, 'Sólo se permiten letras, números y espacios')
      .refine((value) => !containsBlockedWord(value), 'Ese nombre no está permitido')
      .optional(),
    playerNumber: z.coerce
      .number()
      .int()
      .min(limits.minNumber, `El dorsal mínimo es ${limits.minNumber}`)
      .max(limits.maxNumber, `El dorsal máximo es ${limits.maxNumber}`)
      .optional(),
    fontId: z.string().uuid().nullish(),
    patchIds: z.array(z.string().uuid()).default([]),
  });
}
