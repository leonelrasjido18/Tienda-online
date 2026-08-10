import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  REDIS_URL: z.string().min(1, 'REDIS_URL es requerida'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET debe tener al menos 16 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),

  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET debe tener al menos 16 caracteres'),

  ADMIN_URL: z.string().url(),
  STOREFRONT_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url().default('http://localhost:3001'),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_FROM: z.string().default('Tienda <no-reply@tienda.local>'),
  STORE_NOTIFICATION_EMAIL: z.string().email().default('owner@tienda.local'),

  // Pasarela de tarjeta activa. Cambiarla acá alterna entre Mercado Pago y Ualá
  // sin tocar código; las dos siguen procesando webhooks de pagos ya hechos.
  PAYMENT_PROVIDER: z.enum(['mercadopago', 'uala']).default('mercadopago'),

  MP_ACCESS_TOKEN: z.string().default(''),
  MP_WEBHOOK_SECRET: z.string().default(''),

  // Ualá Bis — API Cobros Online v2. Se piden a developers.ualabis@uala.com.ar
  UALA_USERNAME: z.string().default(''),
  UALA_CLIENT_ID: z.string().default(''),
  UALA_CLIENT_SECRET: z.string().default(''),
  UALA_ENV: z.enum(['stage', 'production']).default('stage'),

  VAPID_PUBLIC_KEY: z.string().default(''),
  VAPID_PRIVATE_KEY: z.string().default(''),
  VAPID_SUBJECT: z.string().default('mailto:owner@tienda.local'),

  CHECKOUT_RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  BANK_TRANSFER_RESERVATION_TTL_HOURS: z.coerce.number().int().positive().default(48),

  // Envíos. 'manual' usa la tabla de tarifas por provincia del panel y no depende
  // de nadie; 'andreani' requiere las cuatro credenciales de abajo.
  SHIPPING_PROVIDER: z.enum(['manual', 'andreani']).default('manual'),
  ANDREANI_USER: z.string().default(''),
  ANDREANI_PASSWORD: z.string().default(''),
  ANDREANI_CLIENTE: z.string().default(''),
  ANDREANI_CONTRATO: z.string().default(''),

  /** Días de vigencia del link de cobro del saldo. */
  BALANCE_LINK_TTL_DAYS: z.coerce.number().int().positive().default(14),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Variables de entorno inválidas:\n${issues}`);
  }
  return parsed.data;
}
