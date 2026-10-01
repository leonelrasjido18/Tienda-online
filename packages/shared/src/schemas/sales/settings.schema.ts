import { z } from 'zod';

import { PAYMENT_DISCOUNT_MODES } from '../../lib/payment-discount';

/** Descuento por medio de pago, tal como se guarda y se edita. */
const paymentDiscountSchema = z.object({
  mode: z.enum(PAYMENT_DISCOUNT_MODES),
  /** Porcentaje (1 = 1%) o monto en centavos. Cero = sin descuento. */
  value: z.number().int().nonnegative(),
});

export const updateStoreSettingsSchema = z.object({
  defaultDepositPercent: z.number().int().min(1).max(100).optional(),
  bankTransferInstructions: z.string().max(2000).nullable().optional(),
  whatsappPhone: z.string().max(30).nullable().optional(),
  whatsappMessage: z.string().max(500).nullable().optional(),
  instagramUser: z.string().max(100).nullable().optional(),
  contactEmail: z.string().email().max(200).nullable().optional(),
  pickupAddress: z.string().max(500).nullable().optional(),
  openingHours: z.string().max(200).nullable().optional(),
  enableBankTransfer: z.boolean().optional(),
  enableCardPayment: z.boolean().optional(),
  enableCash: z.boolean().optional(),
  bankTransferDiscount: paymentDiscountSchema.optional(),
  cashDiscount: paymentDiscountSchema.optional(),
});
export type UpdateStoreSettingsInput = z.infer<typeof updateStoreSettingsSchema>;

/** Lo que el storefront necesita saber para dibujar el checkout. */
export const publicStoreSettingsSchema = z.object({
  defaultDepositPercent: z.number().int(),
  bankTransferInstructions: z.string().nullable(),
  /** Métodos realmente disponibles hoy: el storefront no debe ofrecer otros. */
  enabledPaymentMethods: z.array(z.string()),
  // Datos de contacto públicos (se muestran en la página de contacto y el footer).
  whatsappPhone: z.string().nullable(),
  whatsappMessage: z.string().nullable(),
  instagramUser: z.string().nullable(),
  contactEmail: z.string().nullable(),
  pickupAddress: z.string().nullable(),
  openingHours: z.string().nullable(),
  /** Para anunciar el precio promocional en la ficha y en el checkout. */
  bankTransferDiscount: paymentDiscountSchema,
  cashDiscount: paymentDiscountSchema,
});
export type PublicStoreSettingsDto = z.infer<typeof publicStoreSettingsSchema>;

export const storeSettingsSchema = z.object({
  defaultDepositPercent: z.number().int(),
  bankTransferInstructions: z.string().nullable(),
  whatsappPhone: z.string().nullable(),
  whatsappMessage: z.string().nullable(),
  instagramUser: z.string().nullable(),
  contactEmail: z.string().nullable(),
  pickupAddress: z.string().nullable(),
  openingHours: z.string().nullable(),
  enableBankTransfer: z.boolean(),
  enableCardPayment: z.boolean(),
  enableCash: z.boolean(),
  bankTransferDiscount: paymentDiscountSchema,
  cashDiscount: paymentDiscountSchema,
});
export type StoreSettingsDto = z.infer<typeof storeSettingsSchema>;
