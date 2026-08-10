import { Injectable, Logger } from '@nestjs/common';
import { formatOrderNumber } from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../sales/notifications/mail.service';

/** Días desde que se emitió el link en los que se manda cada recordatorio. */
const REMINDER_DAYS = [3, 7];
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Recordatorios de saldo impago y vencimiento de links.
 *
 * Se ejecuta desde el scheduler; expone `run()` para poder dispararlo a mano
 * desde el panel o en una prueba sin esperar al cron.
 */
@Injectable()
export class BalanceRemindersService {
  private readonly logger = new Logger(BalanceRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async run(now = new Date()) {
    const expired = await this.expireOverdueLinks(now);
    const reminded = await this.sendDueReminders(now);
    this.logger.log(`Recordatorios: ${reminded} enviado(s), ${expired} link(s) vencido(s)`);
    return { reminded, expired };
  }

  private async expireOverdueLinks(now: Date) {
    const { count } = await this.prisma.paymentLink.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });
    return count;
  }

  private async sendDueReminders(now: Date) {
    const links = await this.prisma.paymentLink.findMany({
      where: { status: 'PENDING', expiresAt: { gte: now } },
      include: { order: true },
    });

    let sent = 0;
    for (const link of links) {
      const daysSinceCreated = Math.floor((now.getTime() - link.createdAt.getTime()) / DAY_MS);

      // Se manda el recordatorio del hito más alto ya alcanzado que todavía no se envió.
      const due = REMINDER_DAYS.filter((d) => daysSinceCreated >= d).length;
      if (due <= link.remindersSent) continue;

      const daysLeft = Math.max(0, Math.ceil((link.expiresAt.getTime() - now.getTime()) / DAY_MS));

      await this.mail.sendBalanceReminder(
        {
          contactName: link.order.contactName,
          contactEmail: link.order.contactEmail,
          displayNumber: formatOrderNumber(link.order.number),
          balanceCents: link.balanceCents,
          shippingCents: link.shippingCents,
          amountCents: link.amountCents,
          url: `${process.env.STOREFRONT_URL ?? 'http://localhost:3000'}/saldo/${link.token}`,
          expiresAt: link.expiresAt,
        },
        daysLeft,
      );

      await this.prisma.paymentLink.update({
        where: { id: link.id },
        data: { remindersSent: due, lastRemindedAt: now },
      });
      sent += 1;
    }

    return sent;
  }
}
