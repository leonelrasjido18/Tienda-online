import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

/**
 * Cupones de descuento.
 *
 * El controlador de administración validaba con una `interface` de TypeScript,
 * que no existe en tiempo de ejecución: aceptaba un porcentaje de 150, valores
 * negativos o un cuerpo sin código. Un cupón mayor al 100% dejaba pedidos con
 * total negativo, así que el tope de acá no es cosmético.
 */
export const COUPON_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING'] as const;
export type CouponType = (typeof COUPON_TYPES)[number];

export const COUPON_TYPE_LABELS: Record<CouponType, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto fijo',
  FREE_SHIPPING: 'Envío gratis',
};

export const upsertCouponSchema = z
  .object({
    // Se guarda en mayúsculas; el código se compara así en el checkout.
    code: z
      .string()
      .trim()
      .min(3, 'El código debe tener al menos 3 caracteres')
      .max(40)
      .regex(/^[A-Za-z0-9_-]+$/, 'El código sólo admite letras, números, guiones y guiones bajos'),
    type: z.enum(COUPON_TYPES),
    value: z.number().int().nonnegative(),
    minPurchaseCents: moneyCentsSchema.default(0),
    /** null = sin límite de usos. */
    maxUses: z.number().int().positive().nullish(),
    /** Si se activa, cada cliente puede usarlo una sola vez. */
    oncePerCustomer: z.boolean().default(false),
    expiresAt: z.coerce.date().nullish(),
    isActive: z.boolean().default(true),
  })
  .superRefine((valor, ctx) => {
    if (valor.type === 'PERCENTAGE' && (valor.value < 1 || valor.value > 100)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Un descuento por porcentaje va de 1 a 100',
      });
    }
    if (valor.type === 'FIXED_AMOUNT' && valor.value < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'El monto del descuento tiene que ser mayor a cero',
      });
    }
    if (valor.expiresAt && valor.expiresAt.getTime() < Date.now()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiresAt'],
        message: 'La fecha de vencimiento ya pasó',
      });
    }
  });

export type UpsertCouponInput = z.infer<typeof upsertCouponSchema>;

export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotalCents: moneyCentsSchema,
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
