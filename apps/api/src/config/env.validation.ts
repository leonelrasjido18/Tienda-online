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
  // Credenciales del SMTP real (Brevo, Gmail…). En dev (Mailpit) quedan vacías y no
  // se envía bloque de autenticación.
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
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

  // Meta Conversions API (server-side). Opcional: si faltan, no se envía nada.
  META_PIXEL_ID: z.string().default(''),
  META_CAPI_ACCESS_TOKEN: z.string().default(''),

  // Marca en el feed de Google Merchant (opcional).
  MERCHANT_FEED_BRAND: z.string().default('Remeras del Área'),

  // Analizador de estilo de estampado con IA (opcional). Sin la key, el endpoint
  // /customization/analyze devuelve 400 con un mensaje claro y el resto funciona igual.
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  // Requerido solo si la API key está ligada a una identidad/espacio de trabajo
  // (Anthropic pide el header anthropic-workspace-id en ese caso). El ID del
  // workspace no es secreto: se ve en la consola de Claude.
  ANTHROPIC_WORKSPACE_ID: z.string().default(''),

  CHECKOUT_RESERVATION_TTL_MINUTES: z.coerce.number().int().positive().default(20),
  BANK_TRANSFER_RESERVATION_TTL_HOURS: z.coerce.number().int().positive().default(48),

  // Envíos. 'manual' usa la tabla de tarifas por provincia del panel y no depende
  // de nadie; 'andreani' y 'correo_argentino' cotizan por API con las credenciales de abajo.
  SHIPPING_PROVIDER: z.enum(['manual', 'andreani', 'correo_argentino']).default('manual'),
  ANDREANI_USER: z.string().default(''),
  ANDREANI_PASSWORD: z.string().default(''),
  ANDREANI_CLIENTE: z.string().default(''),
  ANDREANI_CONTRATO: z.string().default(''),

  // Correo Argentino — API MiCorreo (cotización por código postal).
  // CORREO_USER/PASSWORD: credenciales de API (se piden a Correo). CUSTOMER_ID:
  // opcional, si se deja vacío se obtiene con /users/validate. ORIGIN: CP de origen.
  CORREO_ENV: z.enum(['test', 'production']).default('test'),
  CORREO_USER: z.string().default(''),
  CORREO_PASSWORD: z.string().default(''),
  CORREO_CUSTOMER_ID: z.string().default(''),
  CORREO_POSTAL_CODE_ORIGIN: z.string().default(''),

  /** Días de vigencia del link de cobro del saldo. */
  BALANCE_LINK_TTL_DAYS: z.coerce.number().int().positive().default(14),

  // Cloudflare Turnstile keys (defaults are CF dummy keys that always pass)
  TURNSTILE_SITE_KEY: z.string().default('1x00000000000000000000AA'),
  TURNSTILE_SECRET_KEY: z.string().default('1x0000000000000000000000000000000AA'),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== 'production') return;

  for (const [key, value] of Object.entries({ JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET, COOKIE_SECRET: env.COOKIE_SECRET })) {
    if (/dev-|change-me|changeme/i.test(value)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'No puede usar un secreto de desarrollo en producción' });
    }
  }
  for (const [key, value] of Object.entries({ ADMIN_URL: env.ADMIN_URL, STOREFRONT_URL: env.STOREFRONT_URL, API_PUBLIC_URL: env.API_PUBLIC_URL })) {
    if (!value.startsWith('https://')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Debe usar HTTPS en producción' });
    }
  }
  if (env.PAYMENT_PROVIDER === 'mercadopago' && (!env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MP_ACCESS_TOKEN'], message: 'Mercado Pago requiere token y secreto de webhook en producción' });
  }
  if (env.PAYMENT_PROVIDER === 'uala' && (!env.UALA_USERNAME || !env.UALA_CLIENT_ID || !env.UALA_CLIENT_SECRET || env.UALA_ENV !== 'production')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['UALA_USERNAME'], message: 'Ualá requiere credenciales y ambiente production en producción' });
  }
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
