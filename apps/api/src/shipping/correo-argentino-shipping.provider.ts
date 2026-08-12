import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShippingQuoteDto } from '@tienda/shared';

import type { Env } from '../config/env.validation';
import { ManualShippingProvider } from './manual-shipping.provider';
import type { ShippingProvider, ShippingQuoteRequest } from './shipping-provider.interface';

const BASE_URLS = {
  test: 'https://apitest.correoargentino.com.ar/micorreo/v1',
  production: 'https://api.correoargentino.com.ar/micorreo/v1',
} as const;

const REQUEST_TIMEOUT_MS = 8000;
// La API valida peso 1..25000 g y dimensiones ≤150 cm. Una camiseta es liviana y
// plana: se usa un paquete por defecto y el peso real que se cargue por producto.
const DEFAULT_WEIGHT_GRAMS = 500;
const DEFAULT_DIMENSIONS = { height: 5, width: 30, length: 25 };
const MAX_WEIGHT_GRAMS = 25000;

interface TokenResponse {
  token?: string;
  expires?: string;
}
interface ValidateResponse {
  customerId?: string;
}
interface RatesResponse {
  rates?: Array<{
    deliveredType?: string;
    productName?: string;
    price?: number | string;
    deliveryTimeMin?: number | string;
    deliveryTimeMax?: number | string;
  }>;
}

/**
 * Cotización contra la API MiCorreo de Correo Argentino (endpoint /rates), por
 * código postal de destino.
 *
 * ⚠️ SIN VERIFICAR CONTRA EL SANDBOX todavía. Está escrito según el manual oficial
 * (API MiCorreo v1), pero falta probarlo con credenciales reales. Antes de confiar
 * en esta cotización en producción:
 *   1. Cargar CORREO_USER / CORREO_PASSWORD (y CORREO_CUSTOMER_ID o dejar que se
 *      resuelva solo) + CORREO_POSTAL_CODE_ORIGIN
 *   2. Poner SHIPPING_PROVIDER=correo_argentino y CORREO_ENV=test
 *   3. Comparar una cotización real contra la calculadora de Correo
 *
 * Ante cualquier falla (sin credenciales, timeout, error HTTP, respuesta rara)
 * delega en las tarifas manuales: mejor cobrar un envío de tabla que dejar al
 * cliente sin poder pagar.
 */
@Injectable()
export class CorreoArgentinoShippingProvider implements ShippingProvider {
  readonly name = 'correo_argentino' as const;
  private readonly logger = new Logger(CorreoArgentinoShippingProvider.name);

  private token: string | null = null;
  private tokenExpiresAt = 0;
  private customerId: string | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly manual: ManualShippingProvider,
  ) {}

  private get baseUrl(): string {
    return this.config.get('CORREO_ENV') === 'production' ? BASE_URLS.production : BASE_URLS.test;
  }

  private get credentials() {
    const user = this.config.get('CORREO_USER');
    const password = this.config.get('CORREO_PASSWORD');
    const origin = this.config.get('CORREO_POSTAL_CODE_ORIGIN');
    return user && password && origin ? { user, password, origin } : null;
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto> {
    const creds = this.credentials;
    if (!creds) {
      return this.fallback(request, 'Correo Argentino no está configurado');
    }
    if (!request.postalCode) {
      return this.fallback(request, 'El pedido no tiene código postal');
    }

    try {
      const token = await this.getToken(creds.user, creds.password);
      const customerId = await this.getCustomerId(token, creds.user, creds.password);

      const weight = Math.min(MAX_WEIGHT_GRAMS, Math.max(1, request.weightGrams || DEFAULT_WEIGHT_GRAMS));
      const res = await fetch(`${this.baseUrl}/rates`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        body: JSON.stringify({
          customerId,
          postalCodeOrigin: creds.origin,
          postalCodeDestination: request.postalCode,
          deliveredType: 'D', // envío a domicilio
          dimensions: { weight, ...DEFAULT_DIMENSIONS },
        }),
      });

      if (!res.ok) {
        return this.fallback(request, `Correo Argentino respondió ${res.status}`);
      }

      const body = (await res.json()) as RatesResponse;
      // Se toma la tarifa a domicilio más barata (puede venir más de un producto).
      const home = (body.rates ?? []).filter((r) => (r.deliveredType ?? 'D') === 'D');
      const cheapest = home
        .map((r) => ({ price: Number(r.price), eta: Number(r.deliveryTimeMax ?? r.deliveryTimeMin) }))
        .filter((r) => Number.isFinite(r.price) && r.price > 0)
        .sort((a, b) => a.price - b.price)[0];

      if (!cheapest) {
        return this.fallback(request, 'Correo Argentino no devolvió una tarifa válida');
      }

      return {
        provider: 'correo_argentino',
        priceCents: Math.round(cheapest.price * 100),
        etaDays: Number.isFinite(cheapest.eta) ? cheapest.eta : null,
        fallbackReason: null,
      };
    } catch (error) {
      this.logger.error('Falló la cotización de Correo Argentino', error instanceof Error ? error.stack : error);
      return this.fallback(request, 'No se pudo contactar a Correo Argentino');
    }
  }

  /** Cae a la tabla manual conservando el motivo, para que se vea en el panel. */
  private async fallback(request: ShippingQuoteRequest, reason: string): Promise<ShippingQuoteDto> {
    const quote = await this.manual.quote(request);
    return { ...quote, fallbackReason: quote.fallbackReason ?? reason };
  }

  /** Token JWT vía Basic Auth. Se cachea hasta un poco antes de su expiración. */
  private async getToken(user: string, password: string): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const basic = Buffer.from(`${user}:${password}`).toString('base64');
    const res = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Token de Correo Argentino falló con ${res.status}`);
    }

    const body = (await res.json()) as TokenResponse;
    if (!body.token) {
      throw new Error('Correo Argentino no devolvió token');
    }

    const expiresAt = body.expires ? Date.parse(body.expires) : NaN;
    // Margen de 1 min; si no vino fecha válida, se cachea 50 min por defecto.
    this.tokenExpiresAt = (Number.isFinite(expiresAt) ? expiresAt : Date.now() + 50 * 60 * 1000) - 60_000;
    this.token = body.token;
    return body.token;
  }

  /** customerId: el de la config si está, o resuelto con /users/validate. Se cachea. */
  private async getCustomerId(token: string, email: string, password: string): Promise<string> {
    const configured = this.config.get('CORREO_CUSTOMER_ID');
    if (configured) return configured;
    if (this.customerId) return this.customerId;

    const res = await fetch(`${this.baseUrl}/users/validate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      throw new Error(`No se pudo validar el usuario de Correo Argentino: ${res.status}`);
    }

    const body = (await res.json()) as ValidateResponse;
    if (!body.customerId) {
      throw new Error('Correo Argentino no devolvió customerId');
    }
    this.customerId = body.customerId;
    return body.customerId;
  }
}
