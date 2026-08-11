import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';
import { hexColor, leagueFontSchema } from './font.schema';
import { patchSchema } from './patch.schema';
import { printAreaSchema } from './print-area.schema';

/**
 * Estilo del estampado por producto (color, contorno, interletrado). Vive en la
 * plantilla y no en la fuente porque el mismo tipo de letra aparece en camisetas
 * con colores muy distintos. Es lo que completa el analizador de IA leyendo la foto.
 */
export const customizationStyleFields = {
  fillColor: hexColor.default('#FFFFFF'),
  strokeColor: hexColor.nullish(),
  strokeWidthPx: z.number().int().min(0).max(20).default(0),
  letterSpacingPx: z.number().int().min(-10).max(50).default(0),
};

export const upsertCustomizationTemplateSchema = z
  .object({
    enableName: z.boolean().default(true),
    enableNumber: z.boolean().default(true),
    enablePatches: z.boolean().default(false),
    maxNameLength: z.number().int().min(1).max(30).default(12),
    minNumber: z.number().int().min(0).max(999).default(1),
    maxNumber: z.number().int().min(0).max(999).default(99),
    nameExtraCents: moneyCentsSchema.default(0),
    numberExtraCents: moneyCentsSchema.default(0),
    fontId: z.string().uuid().nullish(),
    ...customizationStyleFields,
    customizationImageId: z.string().uuid().nullish(),
    namePrintArea: printAreaSchema,
    numberPrintArea: printAreaSchema,
    patchPrintArea: printAreaSchema.nullish(),
    patchIds: z.array(z.string().uuid()).default([]),
  })
  .refine((data) => data.maxNumber >= data.minNumber, {
    message: 'El dorsal máximo tiene que ser mayor o igual al mínimo',
    path: ['maxNumber'],
  });

export type UpsertCustomizationTemplateInput = z.infer<typeof upsertCustomizationTemplateSchema>;

/** Forma de lectura: fuente y parches ya resueltos, para que el storefront no necesite pedidos extra. */
export const productCustomizationSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  enableName: z.boolean(),
  enableNumber: z.boolean(),
  enablePatches: z.boolean(),
  maxNameLength: z.number().int(),
  minNumber: z.number().int(),
  maxNumber: z.number().int(),
  nameExtraCents: z.number().int(),
  numberExtraCents: z.number().int(),
  fillColor: z.string(),
  strokeColor: z.string().nullable(),
  strokeWidthPx: z.number().int(),
  letterSpacingPx: z.number().int(),
  customizationImageId: z.string().uuid().nullable(),
  namePrintArea: printAreaSchema,
  numberPrintArea: printAreaSchema,
  patchPrintArea: printAreaSchema.nullable(),
  font: leagueFontSchema.nullable(),
  patches: z.array(patchSchema),
});

export type ProductCustomizationDto = z.infer<typeof productCustomizationSchema>;
