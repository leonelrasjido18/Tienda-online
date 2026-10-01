import { z } from 'zod';

import { productCustomizationSchema } from '../customization/template.schema';
import { moneyCentsSchema, paginationQuerySchema, slugSchema } from './common.schema';

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const FULFILLMENT_MODES = ['IN_STOCK', 'PREORDER', 'BOTH'] as const;
export type FulfillmentMode = (typeof FULFILLMENT_MODES)[number];

export const MAX_PRODUCT_OPTIONS = 3;

// ---------------------------------------------------------------------------
// Escritura: datos base del producto
// ---------------------------------------------------------------------------

export const upsertProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: slugSchema,
  description: z.string().max(20_000).nullish(),
  status: z.enum(PRODUCT_STATUSES).default('DRAFT'),
  fulfillmentMode: z.enum(FULFILLMENT_MODES).default('IN_STOCK'),
  preorderLeadDays: z.number().int().positive().nullish(),
  brandId: z.string().uuid().nullish(),
  categoryId: z.string().uuid().nullish(),
  leagueId: z.string().uuid().nullish(),
  teamId: z.string().uuid().nullish(),
  seasonId: z.string().uuid().nullish(),
  sizeGuideId: z.string().uuid().nullish(),
  seoTitle: z.string().max(160).nullish(),
  seoDescription: z.string().max(300).nullish(),
  position: z.number().int().default(0),
});

export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

// ---------------------------------------------------------------------------
// Escritura: opciones (Talle, Versión...) y sus valores
// ---------------------------------------------------------------------------

export const productOptionValueInputSchema = z.object({
  value: z.string().min(1).max(60),
  position: z.number().int().default(0),
});

export const productOptionInputSchema = z.object({
  name: z.string().min(1).max(60),
  position: z.number().int().default(0),
  values: z.array(productOptionValueInputSchema).min(1).max(30),
});

export const replaceProductOptionsSchema = z.object({
  options: z.array(productOptionInputSchema).max(MAX_PRODUCT_OPTIONS),
});

export type ReplaceProductOptionsInput = z.infer<typeof replaceProductOptionsSchema>;

// ---------------------------------------------------------------------------
// Escritura: variantes (fila de la grilla: precio + stock combinados)
// ---------------------------------------------------------------------------

export const upsertVariantSchema = z.object({
  sku: z.string().min(1).max(64),
  priceCents: moneyCentsSchema,
  compareAtPriceCents: moneyCentsSchema.nullish(),
  costCents: moneyCentsSchema.nullish(),
  weightGrams: z.number().int().positive().nullish(),
  barcode: z.string().max(64).nullish(),
  position: z.number().int().default(0),
  quantity: z.number().int().nonnegative().default(0),
  trackInventory: z.boolean().default(true),
  allowPreorder: z.boolean().default(false),
  preorderLeadDays: z.number().int().positive().nullish(),
});

export type UpsertVariantInput = z.infer<typeof upsertVariantSchema>;

export const bulkUpdateVariantsSchema = z.object({
  variants: z.array(upsertVariantSchema.partial().extend({ id: z.string().uuid() })).min(1),
});

export type BulkUpdateVariantsInput = z.infer<typeof bulkUpdateVariantsSchema>;

/** Nombres fijos de la opción de manga: el frente los usa para el selector. */
export const SLEEVE_OPTION_NAME = 'Manga';
export const SLEEVE_SHORT_VALUE = 'Corta';
export const SLEEVE_LONG_VALUE = 'Larga';

/**
 * Carga rápida: talles (y opcionalmente manga) más precios, en una sola
 * operación. Hacerlo en tres pasos desde el panel dejaba el producto a medio
 * armar si alguno fallaba, y las variantes recién creadas salían a precio 0.
 */
export const quickVariantSetupSchema = z.object({
  sizes: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  /** Agrega la opción Manga (Corta/Larga) y duplica las combinaciones. */
  withLongSleeve: z.boolean().default(false),
  priceCents: moneyCentsSchema,
  /** Precio de las combinaciones de manga larga. Si falta, se usa `priceCents`. */
  longSleevePriceCents: moneyCentsSchema.nullish(),
  quantity: z.number().int().nonnegative().default(0),
  trackInventory: z.boolean().default(true),
  allowPreorder: z.boolean().default(true),
});

export type QuickVariantSetupInput = z.infer<typeof quickVariantSetupSchema>;

// ---------------------------------------------------------------------------
// Escritura: imágenes
// ---------------------------------------------------------------------------

export const updateProductImageSchema = z.object({
  alt: z.string().max(200).nullish(),
  position: z.number().int().optional(),
  optionValueId: z.string().uuid().nullish(),
  isLongSleeve: z.boolean().optional(),
});

export type UpdateProductImageInput = z.infer<typeof updateProductImageSchema>;

export const reorderProductImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1),
});

export type ReorderProductImagesInput = z.infer<typeof reorderProductImagesSchema>;

// ---------------------------------------------------------------------------
// Lectura: DTOs de respuesta
// ---------------------------------------------------------------------------

export const productOptionValueSchema = z.object({
  id: z.string().uuid(),
  value: z.string(),
  position: z.number().int(),
});
export type ProductOptionValueDto = z.infer<typeof productOptionValueSchema>;

export const productOptionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  position: z.number().int(),
  values: z.array(productOptionValueSchema),
});
export type ProductOptionDto = z.infer<typeof productOptionSchema>;

export const productImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  alt: z.string().nullable(),
  position: z.number().int(),
  optionValueId: z.string().uuid().nullable(),
  isLongSleeve: z.boolean(),
});
export type ProductImageDto = z.infer<typeof productImageSchema>;

export const variantSchema = z.object({
  id: z.string().uuid(),
  sku: z.string(),
  priceCents: z.number().int(),
  compareAtPriceCents: z.number().int().nullable(),
  costCents: z.number().int().nullable(),
  weightGrams: z.number().int().nullable(),
  barcode: z.string().nullable(),
  position: z.number().int(),
  optionValueIds: z.array(z.string().uuid()),
  inventory: z.object({
    quantity: z.number().int(),
    reserved: z.number().int(),
    available: z.number().int(),
    trackInventory: z.boolean(),
    allowPreorder: z.boolean(),
    preorderLeadDays: z.number().int().nullable(),
  }),
});
export type VariantDto = z.infer<typeof variantSchema>;

const taxonomyRefSchema = z.object({ id: z.string().uuid(), name: z.string(), slug: z.string() });

export const productDetailSchema = upsertProductSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
  brand: taxonomyRefSchema.nullable(),
  category: taxonomyRefSchema.nullable(),
  league: taxonomyRefSchema.nullable(),
  team: taxonomyRefSchema.nullable(),
  season: z.object({ id: z.string().uuid(), label: z.string() }).nullable(),
  options: z.array(productOptionSchema),
  variants: z.array(variantSchema),
  images: z.array(productImageSchema),
  customization: productCustomizationSchema.nullable(),
});
export type ProductDetailDto = z.infer<typeof productDetailSchema>;

export const productListItemSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  status: z.enum(PRODUCT_STATUSES),
  fulfillmentMode: z.enum(FULFILLMENT_MODES),
  brandName: z.string().nullable(),
  leagueName: z.string().nullable(),
  teamName: z.string().nullable(),
  seasonLabel: z.string().nullable(),
  minPriceCents: z.number().int().nullable(),
  maxPriceCents: z.number().int().nullable(),
  coverImageUrl: z.string().nullable(),
  totalAvailable: z.number().int(),
});
export type ProductListItemDto = z.infer<typeof productListItemSchema>;

// ---------------------------------------------------------------------------
// Lectura: query de listado público + facetas
// ---------------------------------------------------------------------------

export const PRODUCT_SORT_OPTIONS = ['relevance', 'price_asc', 'price_desc', 'newest'] as const;
export type ProductSort = (typeof PRODUCT_SORT_OPTIONS)[number];

/** Apartados del catalogo por disponibilidad. */
export const PRODUCT_AVAILABILITY = ['stock', 'encargo'] as const;
export type ProductAvailability = (typeof PRODUCT_AVAILABILITY)[number];

export const PRODUCT_AVAILABILITY_LABELS: Record<ProductAvailability, string> = {
  stock: 'Stock inmediato',
  encargo: 'Por encargo',
};

export const productListQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  leagueSlug: z.string().optional(),
  teamSlug: z.string().optional(),
  categorySlug: z.string().optional(),
  seasonId: z.string().uuid().optional(),
  size: z.string().max(60).optional(),
  minPrice: z.coerce.number().int().nonnegative().optional(),
  maxPrice: z.coerce.number().int().nonnegative().optional(),
  sort: z.enum(PRODUCT_SORT_OPTIONS).default('newest'),
  /**
   * Disponibilidad. Se mide contra el stock REAL, no contra fulfillmentMode:
   * un producto marcado "en stock" pero con 0 unidades no se puede entregar ya,
   * y aparecer en ese apartado seria mentirle al cliente.
   */
  disponibilidad: z.enum(PRODUCT_AVAILABILITY).optional(),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

const facetBucketSchema = z.object({ value: z.string(), label: z.string(), count: z.number().int() });

export const productFacetsSchema = z.object({
  leagues: z.array(facetBucketSchema),
  teams: z.array(facetBucketSchema),
  seasons: z.array(facetBucketSchema),
  sizes: z.array(facetBucketSchema),
  priceRange: z.object({ min: z.number().int(), max: z.number().int() }),
});
export type ProductFacetsDto = z.infer<typeof productFacetsSchema>;
