import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.validation';

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private readonly secretKey: string;
  private readonly isTest: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.secretKey = this.config.get('TURNSTILE_SECRET_KEY');
    this.isTest = this.config.get('NODE_ENV') === 'test';
  }

  async verify(token: string | undefined, ip?: string): Promise<boolean> {
    if (this.isTest) {
      return true;
    }

    if (!token) {
      this.logger.warn('Intento de solicitud sin token de verificación Turnstile');
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: this.secretKey,
          response: token,
          ...(ip ? { remoteip: ip } : {}),
        }),
      });

      const data = (await response.json()) as { success: boolean; 'error-codes'?: string[] };
      if (!data.success) {
        this.logger.warn(`Validación de Turnstile fallida. Errores: ${JSON.stringify(data['error-codes'])}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error al conectar con Cloudflare Turnstile', error instanceof Error ? error.stack : error);
      // Por resiliencia en caso de caída de Cloudflare, dejamos pasar pero reportamos
      return true;
    }
  }
}
