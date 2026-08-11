import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { ABANDONED_CART_STAGES } from './abandoned-cart.constants';

@Injectable()
export class AbandonedCartService {
  private readonly logger = new Logger(AbandonedCartService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Recorre los carritos abandonados de clientes identificados y manda el
   * recordatorio de la etapa más alta alcanzada que todavía no se avisó. Sólo
   * aplica a carritos con dueño (logueado): un carrito anónimo no tiene a quién
   * escribirle. La personalización se conserva porque vive en el CartItem.
   */
  async run(now = new Date()) {
    const firstThresholdMs = ABANDONED_CART_STAGES[0].afterMs;

    const carts = await this.prisma.cart.findMany({
      where: {
        customerId: { not: null },
        abandonedStage: { lt: 3 },
        updatedAt: { lt: new Date(now.getTime() - firstThresholdMs) },
        items: { some: {} },
      },
      include: {
        customer: { select: { email: true, name: true } },
        items: { include: { variant: { include: { product: { select: { name: true } } } } } },
      },
    });

    let sent = 0;
    for (const cart of carts) {
      if (!cart.customer?.email || cart.items.length === 0) continue;

      const idleMs = now.getTime() - cart.updatedAt.getTime();
      const targetStage = ABANDONED_CART_STAGES.filter((s) => idleMs >= s.afterMs).at(-1)?.stage ?? 0;
      if (targetStage <= cart.abandonedStage) continue;

      const itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
      const productNames = cart.items.map((i) => i.variant.product.name);

      await this.mail.sendAbandonedCart({
        contactName: cart.customer.name,
        contactEmail: cart.customer.email,
        itemCount,
        productNames,
        recoveryUrl: `${this.config.get('STOREFRONT_URL')}/carrito`,
      });

      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { abandonedStage: targetStage, lastAbandonedReminderAt: now },
      });
      sent += 1;
    }

    this.logger.log(`Carritos abandonados: ${sent} recordatorio(s) enviado(s)`);
    return { sent };
  }
}
