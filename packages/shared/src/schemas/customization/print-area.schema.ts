import { z } from 'zod';

/** Zona de impresión normalizada (0-1) sobre la foto del producto, sin importar su resolución real. */
export const printAreaSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  rotation: z.number().min(-45).max(45).default(0),
  align: z.enum(['left', 'center', 'right']).default('center'),
});

export type PrintArea = z.infer<typeof printAreaSchema>;
