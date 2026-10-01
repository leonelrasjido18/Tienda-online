import { z } from 'zod';

/**
 * Autenticación de clientes por email + contraseña. Se mantiene separada de la
 * autenticación del staff: un cliente nunca debe poder operar el panel.
 */

// Mínimo razonable sin frustrar: 8 caracteres. La fortaleza fina se puede subir
// después con una política más estricta.
const passwordSchema = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(100);

export const customerRegisterSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().trim().min(1).max(120).optional(),
  referredByCode: z.string().trim().max(40).optional(),
  sessionToken: z.string().optional(),
});
export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;

export const customerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Ingresá tu contraseña'),
  sessionToken: z.string().optional(),
});
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

export const customerVerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(12),
});
export type CustomerVerifyEmailInput = z.infer<typeof customerVerifyEmailSchema>;

// Reenvío del código de verificación: el del registro dura 30 minutos y es
// normal que el cliente lo pida de nuevo. Responde siempre igual, exista o no
// la cuenta, por el mismo motivo que `customerRequestResetSchema`.
export const customerResendVerificationSchema = z.object({
  email: z.string().email(),
});
export type CustomerResendVerificationInput = z.infer<typeof customerResendVerificationSchema>;

export const customerRequestResetSchema = z.object({
  email: z.string().email(),
});
export type CustomerRequestResetInput = z.infer<typeof customerRequestResetSchema>;

export const customerResetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(12),
  newPassword: passwordSchema,
});
export type CustomerResetPasswordInput = z.infer<typeof customerResetPasswordSchema>;

export const customerProfileUpdateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  defaultPickupInStore: z.boolean().optional(),
  defaultStreet: z.string().trim().max(200).nullish(),
  defaultNumber: z.string().trim().max(40).nullish(),
  defaultFloor: z.string().trim().max(40).nullish(),
  defaultCity: z.string().trim().max(120).nullish(),
  defaultProvince: z.string().trim().max(120).nullish(),
  defaultPostalCode: z.string().trim().max(20).nullish(),
  defaultNotes: z.string().trim().max(300).nullish(),
});
export type CustomerProfileUpdateInput = z.infer<typeof customerProfileUpdateSchema>;

export const customerAuthResponseSchema = z.object({
  customer: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    emailVerified: z.boolean(),
  }),
});
export type CustomerAuthResponse = z.infer<typeof customerAuthResponseSchema>;
