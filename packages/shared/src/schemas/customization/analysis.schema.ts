import { z } from 'zod';

import { hexColor } from './font.schema';
import { printAreaSchema } from './print-area.schema';

/**
 * Categorías de tipografía que el analizador reconoce en la foto. No es la fuente
 * exacta del club (imposible de tener para cada liga), sino el *estilo* — que es
 * finito y se mapea a la librería de fuentes disponible.
 */
export const FONT_STYLES = ['block', 'rounded', 'condensed', 'serif', 'retro', 'stencil', 'other'] as const;
export type FontStyle = (typeof FONT_STYLES)[number];

export const FONT_STYLE_LABELS: Record<FontStyle, string> = {
  block: 'Bloque',
  rounded: 'Redondeada',
  condensed: 'Condensada',
  serif: 'Serif / clásica',
  retro: 'Retro',
  stencil: 'Stencil',
  other: 'Otra',
};

/**
 * Lo que devuelve el modelo de visión al analizar la foto modelo (la de la espalda
 * con nombre/dorsal de ejemplo). Son los mismos campos que la clienta cargaría a
 * mano en la plantilla de personalización.
 */
export const customizationAnalysisSchema = z.object({
  /** Si la foto muestra un nombre de jugador arriba del número. */
  hasName: z.boolean(),
  /** Si la foto muestra un dorsal. */
  hasNumber: z.boolean(),
  fillColor: hexColor,
  strokeColor: hexColor.nullable(),
  strokeWidthPx: z.number().int().min(0).max(20),
  letterSpacingPx: z.number().int().min(-10).max(50),
  fontStyle: z.enum(FONT_STYLES),
  namePrintArea: printAreaSchema,
  numberPrintArea: printAreaSchema,
  /** Nota corta del modelo sobre lo que detectó (para mostrar al operador). */
  notes: z.string().max(500),
});

export type CustomizationAnalysis = z.infer<typeof customizationAnalysisSchema>;

/** Cuerpo del pedido de análisis: qué foto del producto analizar. */
export const analyzeCustomizationSchema = z.object({
  imageId: z.string().uuid(),
});
export type AnalyzeCustomizationInput = z.infer<typeof analyzeCustomizationSchema>;

/** Respuesta del endpoint: el análisis más la fuente que el servidor pudo mapear. */
export const customizationAnalysisResultSchema = customizationAnalysisSchema.extend({
  /** Fuente de la librería más parecida al estilo detectado, o null si no hubo match. */
  suggestedFontId: z.string().uuid().nullable(),
});

export type CustomizationAnalysisResult = z.infer<typeof customizationAnalysisResultSchema>;
