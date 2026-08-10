import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ShippingQuoteDto } from '@tienda/shared';

import type { Env } from '../config/env.validation';
import { ManualShippingProvider } from './manual-shipping.provider';
import type { ShippingProvider, ShippingQuoteRequest } from './shipping-provider.interface';

const ANDREANI_BASE_URL = 'https://apis.andreani.com';
const TOKEN_TTL_MS = 50 * 60 * 1000; // El token dura 1 h; se renueva antes por las dudas.
const REQUEST_TIMEOUT_MS = 8000;

interface AndreaniTarifaResponse {
  tarifaConIva?: { total?: number | string };
  tarifaSinIva?: { total?: number | string };
  plazoEntrega?: number | string;
}

/**
 * Cotización contra la API de Andreani.
 *
 * ⚠️ SIN VERIFICAR CONTRA EL SANDBOX. Está escrito según la API pública documentada,
 * pero no se pudo probar porque no hay credenciales todavía. Antes de confiar en
 * esta cotización en producción hay que:
 *   1. Cargar ANDREANI_USER / ANDREANI_PASSWORD / ANDREANI_CLIENTE / ANDREANI_CONTRATO
 *   2. Poner SHIPPING_PROVIDER=andreani
 *   3. Comparar una cotización real contra la calculadora de Andreani
 *
 * Mientras tanto, y ante cualquier falla (sin credenciales, timeout, error HTTP,
 * respuesta inesperada), delega en las tarifas manuales: es preferible cobrar un
 * envío de tabla que dejar al cliente sin poder pagar el saldo.
 */
@Injectable()
export class AndreaniShippingProvider implements ShippingProvider {
  readonly name = 'andreani' as const;
  private readonly logger = new Logger(AndreaniShippingProvider.name);

  private token: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly manual: ManualShippingProvider,
  ) {}

  private get credentials() {
    const user = this.config.get('ANDREANI_USER');
    const password = this.config.get('ANDREANI_PASSWORD');
    const cliente = this.config.get('ANDREANI_CLIENTE');
    const contrato = this.config.get('ANDREANI_CONTRATO');
    return user && password && cliente && contrato ? { user, password, cliente, contrato } : null;
  }

  async quote(request: ShippingQuoteRequest): Promise<ShippingQuoteDto> {
    const creds = this.credentials;
    if (!creds) {
      return this.fallback(request, 'Andreani no está configurado');
    }
    if (!request.postalCode) {
      return this.fallback(request, 'El pedido no tiene código postal');
    }

    try {
      const token = await this.getToken(creds.user, creds.password);
      const params = new URLSearchParams({
        cpDestino: request.postalCode,
        contrato: creds.contrato,
        cliente: creds.cliente,
        'bultos[0][valorDeclarado]': String(Math.round(request.declaredValueCents / 100)),
        'bultos[0][kilos]': String(Math.max(0.1, request.weightGrams / 1000)),
      });

      const res = await fetch(`${ANDREANI_BASE_URL}/v1/tarifas?${params.toString()}`, {
        headers: { 'x-authorization-token': token },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!res.ok) {
        return this.fallback(request, `Andreani respondió ${res.status}`);
      }

      const body = (await res.json()) as AndreaniTarifaResponse;
      const total = Number(body.tarifaConIva?.total ?? body.tarifaSinIva?.total);
      if (!Number.isFinite(total) || total <= 0) {
        return this.fallback(request, 'Andreani no devolvió una tarifa válida');
      }

      const plazo = Number(body.plazoEntrega);
      return {
        provider: 'andreani',
        priceCents: Math.round(total * 100),
        etaDays: Number.isFinite(plazo) ? plazo : null,
        fallbackReason: null,
      };
    } catch (error) {
      this.logger.error('Falló la cotización de Andreani', error instanceof Error ? error.stack : error);
      return this.fallback(request, 'No se pudo contactar a Andreani');
    }
  }

  async createLabel(orderId: string, address: {
    street: string;
    number: string | null;
    floor: string | null;
    city: string;
    province: string;
    postalCode: string;
    contactName: string;
    contactPhone: string | null;
    contactEmail: string;
  }): Promise<{ trackingNumber: string; labelUrl: string }> {
    const creds = this.credentials;
    if (!creds) {
      throw new Error('Andreani no está configurado');
    }
    const token = await this.getToken(creds.user, creds.password);
    const body = {
      contrato: creds.contrato,
      cliente: creds.cliente,
      destinatario: {
        nombre: address.contactName,
        email: address.contactEmail,
        telefono: address.contactPhone ?? '',
      },
      direccion: {
        calle: address.street,
        numero: address.number ?? '',
        piso: address.floor ?? '',
        localidad: address.city,
        provincia: address.province,
        codigoPostal: address.postalCode,
      },
    };

    const res = await fetch(`${ANDREANI_BASE_URL}/v1/ordenes-de-envio`, {
      method: 'POST',
      headers: {
        'x-authorization-token': token,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`Andreani rechazó la orden de envío: ${res.status}`);
    }

    const resBody = await res.json() as any;
    const trackingNumber = resBody.numeroEnvio || resBody.trackingNumber;
    const labelUrl = resBody.bultos?.[0]?.linkPdf || resBody.labelUrl;

    if (!trackingNumber) {
      throw new Error('Andreani no devolvió un código de seguimiento');
    }

    return {
      trackingNumber,
      labelUrl: labelUrl ?? '',
    };
  }

  async getTracking(trackingNumber: string): Promise<{ status: string; events: Array<{ status: string; message: string; date: string }> }> {
    const creds = this.credentials;
    if (!creds) {
      throw new Error('Andreani no está configurado');
    }
    const token = await this.getToken(creds.user, creds.password);
    const res = await fetch(`${ANDREANI_BASE_URL}/v1/envios/${trackingNumber}`, {
      headers: { 'x-authorization-token': token },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new Error(`Andreani falló al obtener tracking: ${res.status}`);
    }

    const resBody = await res.json() as any;
    const rawEvents = resBody.eventos || [];
    const events = rawEvents.map((ev: any) => ({
      status: ev.estado || ev.status || 'UNKNOWN',
      message: ev.motivo || ev.message || '',
      date: ev.fecha || ev.date || new Date().toISOString(),
    }));

    return {
      status: resBody.estado || 'UNKNOWN',
      events,
    };
  }

  /** Cae a la tabla manual conservando el motivo, para que se vea en el panel. */
  private async fallback(request: ShippingQuoteRequest, reason: string): Promise<ShippingQuoteDto> {
    const quote = await this.manual.quote(request);
    return { ...quote, fallbackReason: quote.fallbackReason ?? reason };
  }

  private async getToken(user: string, password: string): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const basic = Buffer.from(`${user}:${password}`).toString('base64');
    const res = await fetch(`${ANDREANI_BASE_URL}/login`, {
      headers: { Authorization: `Basic ${basic}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Login de Andreani falló con ${res.status}`);
    }

    const token = res.headers.get('x-authorization-token');
    if (!token) {
      throw new Error('Andreani no devolvió token de autorización');
    }

    this.token = token;
    this.tokenExpiresAt = Date.now() + TOKEN_TTL_MS;
    return token;
  }
}
