import { z } from 'zod';

export const slugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'El slug solo puede tener minúsculas, números y guiones');

export const moneyCentsSchema = z.number().int().nonnegative();

/**
 * URL de imagen: acepta una URL absoluta (http/https) o una ruta relativa de un
 * archivo subido ("/uploads/..."). Los logos y portadas se guardan como rutas
 * relativas servidas por la API, así que `.url()` a secas las rechaza.
 */
export const imageUrlSchema = z
  .string()
  .refine(
    (value) => /^https?:\/\//i.test(value) || value.startsWith('/'),
    'Debe ser una URL válida o un archivo subido',
  );

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}
