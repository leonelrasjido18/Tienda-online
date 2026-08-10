import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatOrderNumber, type PaymentStatus } from '@tienda/shared';

import type { Env } from '../../config/env.validation';
import type {
  CreateCheckoutInput,
  CreatedCheckout,
  PaymentProvider,
  ResolvedWebhook,
  WebhookContext,
} from './payment-provider.interface';

const PROD = { auth: 'https://auth.developers.ar.ua.la/v2/api', checkout: 'https://checkout.developers.ar.ua.la/v2/api' };
const STAGE = {
  auth: 'https://auth.stage.developers.ar.ua.la/v2/api',
  checkout: 'https://checkout.stage.developers.ar.ua.la/v2/api',
};

const REQUEST_TIMEOUT_MS = 10_000;
/** El token dura 24 h; se renueva antes para no cortar un checkout a mitad. */
const TOKEN_SAFETY_MARGIN_MS = 5 * 60 * 1000;

interface UalaTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface UalaCheckoutResponse {
  uuid?: string;
  links?: { checkout_link?: string };
}

interface UalaOrderResponse {
  uuid?: string;
  status?: string;
  amount?: number;
  external_reference?: string;
}

interface UalaWebhookBody {
  uuid?: string;
  external_reference?: string;
  status?: string;
  created_date?: string;
}

/**
 * Ualá Bis — API Cobros Online v2.
 *
 * ⚠️ ESCRITO CONTRA LA DOCUMENTACIÓN, SIN PROBAR CONTRA EL SANDBOX todavía
 * (faltan credenciales). Antes de cobrar de verdad hay que correr un pago de
 * prueba completo contra el ambiente `stage`.
 *
 * ⚠️ SEGURIDAD: el webhook de Ualá NO trae firma ni ningún mecanismo de
 * autenticidad documentado. Por eso `resolveWebhook` **ignora el estado que
 * viene en el cuerpo** y siempre reconsulta `GET /orders/:uuid`. Sin esto,
 * cualquiera que descubra la URL podría marcar pedidos como pagados.
 */
@Injectable()
export class UalaService implements PaymentProvider {
  readonly name = 'uala' as const;
  private readonly logger = new Logger(UalaService.name);

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get credentials() {
    const username = this.config.get('UALA_USERNAME');
    const clientId = this.config.get('UALA_CLIENT_ID');
    const clientSecret = this.config.get('UALA_CLIENT_SECRET');
    return username && clientId && clientSecret ? { username, clientId, clientSecret } : null;
  }

  get isConfigured(): boolean {
    return this.credentials !== null;
  }

  private get urls() {
    return this.config.get('UALA_ENV') === 'production' ? PROD : STAGE;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const token = await this.getToken();
    const storefront = this.config.get('STOREFRONT_URL');
    const apiUrl = this.config.get('API_PUBLIC_URL');

    // Ualá exige URLs públicas: rechaza localhost/127.0.0.1 con un error genérico.
    // Se avisa antes de llamarla para no perder tiempo depurando "Invalid request payload".
    const localUrl = [storefront, apiUrl].find((u) => /localhost|127\.0\.0\.1/.test(u));
    if (localUrl) {
      throw new BadRequestException(
        `Ualá no acepta URLs locales (${localUrl}). Para probar en desarrollo exponé la app con un túnel ` +
          '(ngrok o similar) y apuntá STOREFRONT_URL y API_PUBLIC_URL a esa dirección pública.',
      );
    }

    const res = await fetch(`${this.urls.checkout}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        // Ualá espera el monto en pesos como string; nosotros guardamos centavos.
        amount: (input.amountCents / 100).toFixed(2),
        description: `Pedido ${formatOrderNumber(input.orderNumber)} — ${input.kindLabel}`,
        callback_success: `${storefront}/pedido/${input.orderToken}?estado=aprobado`,
        callback_fail: `${storefront}/pedido/${input.orderToken}?estado=rechazado`,
        notification_url: `${apiUrl}/payments/uala/webhook`,
        external_reference: input.paymentId,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Ualá rechazó la creación del checkout (${res.status}): ${detail}`);
      throw new BadRequestException('No pudimos generar el pago con Ualá. Probá de nuevo en unos minutos.');
    }

    const body = (await res.json()) as UalaCheckoutResponse;
    if (!body.uuid || !body.links?.checkout_link) {
      throw new BadRequestException('Ualá no devolvió un checkout válido');
    }

    return { providerRef: body.uuid, redirectUrl: body.links.checkout_link };
  }

  async resolveWebhook(ctx: WebhookContext): Promise<ResolvedWebhook | null> {
    const body = (ctx.body ?? {}) as UalaWebhookBody;
    const uuid = body.uuid;
    if (!uuid) {
      return null;
    }

    // Nunca se confía en body.status: se reconsulta el estado real a Ualá.
    const order = await this.fetchOrder(uuid);
    const paymentId = order.external_reference ?? body.external_reference;
    if (!paymentId || typeof order.amount !== 'number') {
      throw new UnauthorizedException('El webhook no referencia ningún pago conocido');
    }

    return {
      // Ualá no manda un id de evento propio, así que se compone uno estable a
      // partir del uuid + el estado verificado: reintentos del mismo estado se
      // descartan por idempotencia, pero un cambio real sí se procesa.
      eventId: `${uuid}:${order.status ?? 'UNKNOWN'}`,
      paymentId,
      status: this.mapStatus(order.status),
      providerPaymentId: uuid,
      amountCents: Math.round(order.amount * 100),
      raw: order,
    };
  }

  async refund(providerPaymentId: string, amountCents: number): Promise<{ providerRefundId: string; status: PaymentStatus }> {
    const token = await this.getToken();
    const res = await fetch(`${this.urls.checkout}/orders/${providerPaymentId}/refund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        amount: (amountCents / 100).toFixed(2),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      this.logger.error(`Ualá rechazó el reembolso de ${providerPaymentId} (${res.status}): ${detail}`);
      throw new BadRequestException('No se pudo procesar el reembolso con Ualá.');
    }

    const body = (await res.json()) as { id?: string; status?: string; uuid?: string };
    return {
      providerRefundId: body.id ?? body.uuid ?? providerPaymentId,
      status: 'APPROVED',
    };
  }

  private async fetchOrder(uuid: string): Promise<UalaOrderResponse> {
    const token = await this.getToken();
    const res = await fetch(`${this.urls.checkout}/orders/${uuid}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      this.logger.error(`No se pudo verificar la orden ${uuid} contra Ualá (${res.status})`);
      throw new UnauthorizedException('No se pudo verificar el pago contra Ualá');
    }

    return (await res.json()) as UalaOrderResponse;
  }

  private mapStatus(status: string | undefined): PaymentStatus {
    switch (status) {
      case 'APPROVED':
        return 'APPROVED';
      // PROCESSED = cobrado al comprador pero todavía sin desembolsar al comercio.
      // Para la tienda el pedido ya está pago.
      case 'PROCESSED':
        return 'APPROVED';
      case 'REJECTED':
        return 'REJECTED';
      default:
        return 'PENDING';
    }
  }

  private async getToken(): Promise<string> {
    const creds = this.credentials;
    if (!creds) {
      throw new BadRequestException('Ualá no está configurado en este ambiente');
    }
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const res = await fetch(`${this.urls.auth}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        username: creds.username,
        client_id: creds.clientId,
        client_secret_id: creds.clientSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!res.ok) {
      throw new BadRequestException(`No se pudo autenticar contra Ualá (${res.status})`);
    }

    const body = (await res.json()) as UalaTokenResponse;
    if (!body.access_token) {
      throw new BadRequestException('Ualá no devolvió un token de acceso');
    }

    const ttlMs = (body.expires_in ?? 86400) * 1000;
    this.token = body.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(0, ttlMs - TOKEN_SAFETY_MARGIN_MS);
    return this.token;
  }
}
