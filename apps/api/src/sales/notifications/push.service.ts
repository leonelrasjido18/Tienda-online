import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushSubscriptionInput } from '@tienda/shared';
import webpush from 'web-push';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Lo usa el service worker para avisarle al panel abierto qué pedido entró. */
  orderId?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly enabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    const publicKey = this.config.get('VAPID_PUBLIC_KEY');
    const privateKey = this.config.get('VAPID_PRIVATE_KEY');
    this.enabled = Boolean(publicKey && privateKey);

    if (this.enabled) {
      webpush.setVapidDetails(this.config.get('VAPID_SUBJECT'), publicKey, privateKey);
    }
  }

  async subscribe(input: PushSubscriptionInput, userAgent: string | undefined) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
      update: { p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent },
    });
    return { success: true };
  }

  async unsubscribe(endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint } });
    return { success: true };
  }

  async broadcast(payload: PushPayload) {
    if (!this.enabled) {
      this.logger.warn('VAPID no configurado: se omite el envío de push');
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany();
    const body = JSON.stringify(payload);

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            body,
          );
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
          } else {
            this.logger.error(`Push falló para ${sub.endpoint}`, error instanceof Error ? error.stack : error);
          }
        }
      }),
    );
  }
}
