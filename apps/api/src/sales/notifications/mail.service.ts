import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatCentsAsArs, formatOrderNumber } from '@tienda/shared';
import { createTransport, type Transporter } from 'nodemailer';

import type { Env } from '../../config/env.validation';

interface BalanceMailContext {
  contactName: string;
  contactEmail: string;
  displayNumber: string;
  balanceCents: number;
  shippingCents: number;
  amountCents: number;
  url: string;
  expiresAt: Date;
}

interface OrderMailContext {
  number: number;
  contactName: string;
  contactEmail: string;
  totalCents: number;
  dueTodayCents: number;
  paymentPlan: 'FULL' | 'DEPOSIT_BALANCE';
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly notificationEmail: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.transporter = createTransport({
      host: this.config.get('SMTP_HOST'),
      port: this.config.get('SMTP_PORT'),
      secure: false,
    });
    this.from = this.config.get('SMTP_FROM');
    this.notificationEmail = this.config.get('STORE_NOTIFICATION_EMAIL');
  }

  async sendOrderConfirmation(order: OrderMailContext) {
    const displayNumber = formatOrderNumber(order.number);
    const dueTodayLabel = formatCentsAsArs(order.dueTodayCents);

    await this.send({
      to: order.contactEmail,
      subject: `Confirmamos tu pedido ${displayNumber}`,
      html: `
        <p>Hola ${order.contactName},</p>
        <p>Recibimos tu pedido <strong>${displayNumber}</strong> por un total de ${formatCentsAsArs(order.totalCents)}.</p>
        <p>${
          order.paymentPlan === 'DEPOSIT_BALANCE'
            ? `Corresponde una seña de <strong>${dueTodayLabel}</strong> hoy. El saldo se cobra cuando llegue tu pedido desde China.`
            : `Total a pagar hoy: <strong>${dueTodayLabel}</strong>.`
        }</p>
      `,
    });
  }

  async sendSaleAlert(order: OrderMailContext, eventLabel: string) {
    const displayNumber = formatOrderNumber(order.number);
    await this.send({
      to: this.notificationEmail,
      subject: `${eventLabel}: pedido ${displayNumber} — ${formatCentsAsArs(order.totalCents)}`,
      html: `
        <p>${eventLabel}</p>
        <p>Pedido ${displayNumber} de ${order.contactName} (${order.contactEmail}).</p>
        <p>Total: ${formatCentsAsArs(order.totalCents)}</p>
      `,
    });
  }

  /** Aviso de que llegó el pedido y hay que pagar el saldo + envío. */
  async sendBalanceRequest(ctx: BalanceMailContext) {
    await this.send({
      to: ctx.contactEmail,
      subject: `¡Llegó tu pedido ${ctx.displayNumber}! Resta abonar ${formatCentsAsArs(ctx.amountCents)}`,
      html: `
        <p>Hola ${ctx.contactName},</p>
        <p>Tu pedido <strong>${ctx.displayNumber}</strong> ya llegó y está listo para despacharse.</p>
        <p>
          Saldo: ${formatCentsAsArs(ctx.balanceCents)}<br/>
          Envío: ${formatCentsAsArs(ctx.shippingCents)}<br/>
          <strong>Total a pagar: ${formatCentsAsArs(ctx.amountCents)}</strong>
        </p>
        <p><a href="${ctx.url}">Pagar el saldo</a></p>
        <p>El link vence el ${ctx.expiresAt.toLocaleDateString('es-AR')}.</p>
      `,
    });
  }

  /** Recordatorio de saldo impago. */
  async sendBalanceReminder(ctx: BalanceMailContext, daysLeft: number) {
    await this.send({
      to: ctx.contactEmail,
      subject: `Recordatorio: te falta abonar el pedido ${ctx.displayNumber}`,
      html: `
        <p>Hola ${ctx.contactName},</p>
        <p>Tu pedido <strong>${ctx.displayNumber}</strong> sigue esperando el pago del saldo.</p>
        <p><strong>Total a pagar: ${formatCentsAsArs(ctx.amountCents)}</strong></p>
        <p><a href="${ctx.url}">Pagar ahora</a></p>
        <p>${daysLeft > 0 ? `Te quedan ${daysLeft} día(s) antes de que venza el link.` : 'El link está por vencer.'}</p>
      `,
    });
  }

  /** Aviso de que el pedido fue despachado. */
  async sendShipmentNotification(ctx: { contactName: string; contactEmail: string; number: number; provider: string; trackingNumber: string }) {
    const displayNumber = formatOrderNumber(ctx.number);
    await this.send({
      to: ctx.contactEmail,
      subject: `Tu pedido ${displayNumber} fue despachado`,
      html: `
        <p>Hola ${ctx.contactName},</p>
        <p>Te avisamos que tu pedido <strong>${displayNumber}</strong> ya fue despachado.</p>
        <p>
          Empresa de correo: <strong>${ctx.provider}</strong><br/>
          Código de seguimiento: <strong>${ctx.trackingNumber}</strong>
        </p>
        <p>Podés hacer el seguimiento con el código en la página del correo correspondiente.</p>
      `,
    });
  }

  private async send(message: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
    } catch (error) {
      this.logger.error(`No se pudo enviar el email a ${message.to}`, error instanceof Error ? error.stack : error);
    }
  }
}
