import { z } from 'zod';

import { FULFILLMENT_MODES } from '../catalog/product.schema';

export const cartCustomizationDraftSchema = z.object({
  playerName: z.string().max(60).optional(),
  playerNumber: z.coerce.number().int().optional(),
  fontId: z.string().uuid().nullish(),
  patchIds: z.array(z.string().uuid()).default([]),
});
export type CartCustomizationDraft = z.infer<typeof cartCustomizationDraftSchema>;

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().int().positive().max(20).default(1),
  customization: cartCustomizationDraftSchema.nullish(),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().min(0).max(20),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const cartItemSchema = z.object({
  id: z.string().uuid(),
  variantId: z.string().uuid(),
  productId: z.string().uuid(),
  productSlug: z.string(),
  productName: z.string(),
  optionsLabel: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sku: z.string(),
  quantity: z.number().int(),
  unitPriceCents: z.number().int(),
  extraCents: z.number().int(),
  totalCents: z.number().int(),
  fulfillmentMode: z.enum(FULFILLMENT_MODES),
  available: z.number().int(),
  allowPreorder: z.boolean(),
  customization: cartCustomizationDraftSchema.nullable(),
});
export type CartItemDto = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string().uuid(),
  items: z.array(cartItemSchema),
  subtotalCents: z.number().int(),
  requiresDeposit: z.boolean(),
});
export type CartDto = z.infer<typeof cartSchema>;
