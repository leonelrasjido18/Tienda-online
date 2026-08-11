import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.validation';

interface PurchaseEvent {
  /** Mismo id que el Pixel del cliente para deduplicar (usamos el número de orden). */
  eventId: string;
  email: string;
  phone?: string | null;
  valueCents: number;
  currency?: string;
  contentIds?: string[];
}

/**
 * Meta Conversions API (server-side). Envía el evento Purchase directo desde el
 * backend, complementando el Pixel del navegador (más robusto ante bloqueadores).
 *
 * Está env-gated: sin META_PIXEL_ID + META_CAPI_ACCESS_TOKEN es un no-op. Nunca
 * lanza: la analítica jamás debe tumbar el flujo de pago.
 */
@Injectable()
export class MetaConversionsService {
  private readonly logger = new Logger(MetaConversionsService.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  private get credentials() {
    const pixelId = this.config.get('META_PIXEL_ID');
    const accessToken = this.config.get('META_CAPI_ACCESS_TOKEN');
    return pixelId && accessToken ? { pixelId, accessToken } : null;
  }

  async trackPurchase(event: PurchaseEvent): Promise<void> {
    const creds = this.credentials;
    if (!creds) return;

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          event_id: event.eventId,
          action_source: 'website',
          user_data: {
            em: [this.hash(event.email)],
            ...(event.phone ? { ph: [this.hash(event.phone)] } : {}),
          },
          custom_data: {
            currency: event.currency ?? 'ARS',
            value: (event.valueCents / 100).toFixed(2),
            ...(event.contentIds?.length ? { content_ids: event.contentIds, content_type: 'product' } : {}),
          },
        },
      ],
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${creds.pixelId}/events?access_token=${encodeURIComponent(creds.accessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        this.logger.warn(`Meta CAPI rechazó el evento (${res.status}): ${detail}`);
      }
    } catch (error) {
      this.logger.warn(`No se pudo enviar el evento a Meta CAPI: ${(error as Error).message}`);
    }
  }

  /** Meta exige los datos de contacto normalizados (minúsculas/trim) y hasheados SHA-256. */
  private hash(value: string): string {
    return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
  }
}
