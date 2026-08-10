import type { CardPaymentMethod, PaymentStatus } from '@tienda/shared';

/** Lo que necesita cualquier pasarela para armar un cobro. */
export interface CreateCheckoutInput {
  /** Nuestro Payment.id: viaja como referencia externa y vuelve en el webhook. */
  paymentId: string;
  orderId: string;
  orderToken: string;
  orderNumber: number;
  kindLabel: string;
  amountCents: number;
}

export interface CreatedCheckout {
  /** Identificador de la pasarela (preference de MP, uuid de Ualá). */
  providerRef: string;
  /** A dónde se manda al comprador. */
  redirectUrl: string;
}

/** Contexto crudo del webhook, tal como llegó. */
export interface WebhookContext {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string>;
  body: unknown;
}

/**
 * Resultado ya normalizado y **verificado contra la pasarela**, nunca derivado
 * del cuerpo del webhook.
 */
export interface ResolvedWebhook {
  /** Clave de idempotencia; se guarda en WebhookEvent junto al provider. */
  eventId: string;
  /** Nuestro Payment.id. */
  paymentId: string;
  status: PaymentStatus;
  providerPaymentId: string;
  amountCents: number;
  currency?: string;
  raw: unknown;
}

/**
 * Contrato único de cobros. Agregar o cambiar de pasarela no toca la lógica de
 * negocio: sólo se registra otra implementación.
 */
export interface PaymentProvider {
  readonly name: CardPaymentMethod;
  /** Si faltan credenciales, el checkout no debe ofrecer esta pasarela. */
  readonly isConfigured: boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout>;

  /**
   * Valida el webhook y devuelve el estado REAL consultado a la pasarela.
   * Devuelve null si el evento no es relevante (ping, tipo desconocido).
   * Debe lanzar si el evento es sospechoso o no se puede verificar.
   */
  resolveWebhook(ctx: WebhookContext): Promise<ResolvedWebhook | null>;

  refund?(providerPaymentId: string, amountCents: number): Promise<{ providerRefundId: string; status: PaymentStatus }>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
