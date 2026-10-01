import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatCentsAsArs, formatOrderNumber, type OrderDetailDto, type OrderItemDto } from '@tienda/shared';
import { createTransport, type Transporter } from 'nodemailer';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailTemplatesService } from './email-templates.service';

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

/**
 * Los mails de pedido se arman con el mismo DTO que consume el panel, para que
 * lo que ve el cliente en el correo y lo que ve el dueño en la pantalla no se
 * separen con el tiempo.
 */
type OrderMail = OrderDetailDto & { dueTodayCents: number };

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly notificationEmail: string;
  private readonly storefrontUrl: string;

  // Estado del último envío. `send` traga los errores a propósito (que falle un
  // mail no debe tumbar un pedido ya cobrado), así que sin esto un SMTP caído es
  // invisible: el cliente deja de recibir confirmaciones y nadie se entera. Lo
  // lee `GET /health` para que el fallo se pueda ver desde afuera.
  private consecutiveFailures = 0;
  private lastFailureAt: Date | null = null;
  private lastFailureReason: string | null = null;
  private lastSuccessAt: Date | null = null;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
    private readonly templates: EmailTemplatesService,
  ) {
    const port = this.config.get('SMTP_PORT');
    const user = this.config.get('SMTP_USER');
    const pass = this.config.get('SMTP_PASS');
    this.transporter = createTransport({
      host: this.config.get('SMTP_HOST'),
      port,
      // 465 usa TLS directo; 587 (Brevo) arranca en claro y sube a TLS con STARTTLS.
      secure: port === 465,
      // Los SMTP reales (Brevo, Gmail…) exigen autenticación; en dev (Mailpit) no hay
      // credenciales y se omite el bloque `auth`.
      ...(user && pass ? { auth: { user, pass } } : {}),
      // Los envíos se esperan dentro del request (registrarse manda el código de
      // verificación). Sin tope, un SMTP que no responde deja la petición colgada
      // hasta el timeout del sistema operativo, que son minutos.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    this.from = this.config.get('SMTP_FROM');
    this.notificationEmail = this.config.get('STORE_NOTIFICATION_EMAIL');
    // Sin la barra final, así los templates arman las rutas con `${url}/loquesea`
    // sin terminar con una doble barra.
    this.storefrontUrl = this.config.get('STOREFRONT_URL').replace(/\/+$/, '');
  }

  /** Una línea de producto con sus opciones, personalización y precio. */
  private renderItem(item: OrderItemDto): string {
    const titulo = item.productSlug
      ? `<a href="${escapeHtml(`${this.storefrontUrl}/productos/${item.productSlug}`)}" style="color:#111827;font-weight:bold;text-decoration:underline;">${escapeHtml(item.productName)}</a>`
      : `<strong>${escapeHtml(item.productName)}</strong>`;

    // Se prefieren las opciones con su nombre ("Talle: S"); `optionsLabel` queda
    // de respaldo para pedidos viejos o si se borró el producto.
    const opciones = item.options.length
      ? item.options.map((o) => `${escapeHtml(o.name)}: <strong>${escapeHtml(o.value)}</strong>`).join(' &nbsp;·&nbsp; ')
      : item.optionsLabel
        ? escapeHtml(item.optionsLabel)
        : '';

    const c = item.customization;
    let personalizacion = '';
    if (c) {
      const partes: string[] = [];
      if (c.playerName) partes.push(`Nombre: <strong>${escapeHtml(c.playerName)}</strong>`);
      if (c.playerNumber !== null) partes.push(`Número: <strong>${c.playerNumber}</strong>`);
      if (c.fontName) partes.push(`Tipografía: ${escapeHtml(c.fontName)}`);
      if (c.patchNames.length) partes.push(`Parches: ${c.patchNames.map(escapeHtml).join(', ')}`);
      if (c.extraCents > 0) partes.push(`Adicional: ${formatCentsAsArs(c.extraCents)}`);
      personalizacion = `
        <div style="margin-top:8px;padding:8px 10px;background:#FEF3C7;border-left:3px solid #D97706;font-size:13px;color:#78350F;">
          <strong style="text-transform:uppercase;letter-spacing:.04em;font-size:11px;">Personalizada</strong><br/>
          ${partes.join('<br/>') || 'Sin datos cargados'}
        </div>`;
    }

    const foto = item.imageUrl
      ? `<img src="${escapeHtml(item.imageUrl)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #E5E7EB;">`
      : '';

    const entrega = item.fulfillmentMode === 'PREORDER' ? 'Por encargo' : 'Stock inmediato';

    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;width:80px;">${foto}</td>
        <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;font-size:14px;color:#374151;">
          ${titulo}<br/>
          ${opciones ? `<span style="font-size:13px;color:#4B5563;">${opciones}</span><br/>` : ''}
          <span style="font-size:12px;color:#6B7280;">${entrega} &nbsp;·&nbsp; Cantidad: ${item.quantity}</span>
          ${personalizacion}
        </td>
        <td style="padding:14px 0;border-bottom:1px solid #E5E7EB;vertical-align:top;text-align:right;font-size:14px;color:#111827;white-space:nowrap;">
          ${formatCentsAsArs(item.totalCents)}
        </td>
      </tr>`;
  }

  /** Cómo recibe el pedido: retiro en el local o envío a domicilio. */
  private renderEnvio(order: OrderDetailDto): string {
    if (order.pickupInStore) {
      return `<p style="margin:0;font-size:14px;color:#374151;"><strong>Retiro en el local</strong> (Paraná) — sin costo de envío.</p>`;
    }
    const dom = [
      [order.shippingStreet, order.shippingNumber].filter(Boolean).join(' '),
      order.shippingFloor,
      order.shippingCity,
      order.shippingProvince,
      order.shippingPostalCode ? `CP ${order.shippingPostalCode}` : null,
    ]
      .filter(Boolean)
      .map((l) => escapeHtml(String(l)))
      .join('<br/>');
    return `
      <p style="margin:0 0 6px;font-size:14px;color:#374151;"><strong>Envío a domicilio</strong></p>
      <p style="margin:0;font-size:14px;color:#4B5563;line-height:1.6;">${dom || 'Dirección no cargada'}</p>
      ${order.shippingNotes ? `<p style="margin:6px 0 0;font-size:13px;color:#6B7280;">Nota: ${escapeHtml(order.shippingNotes)}</p>` : ''}
      <p style="margin:8px 0 0;font-size:13px;color:#6B7280;">El costo del envío se coordina por WhatsApp cuando el pedido está listo.</p>`;
  }

  private renderTotales(order: OrderMail): string {
    const fila = (etiqueta: string, valor: string, fuerte = false) => `
      <tr>
        <td style="padding:4px 0;font-size:${fuerte ? '15' : '14'}px;color:${fuerte ? '#111827' : '#4B5563'};${fuerte ? 'font-weight:bold;' : ''}">${etiqueta}</td>
        <td style="padding:4px 0;text-align:right;font-size:${fuerte ? '15' : '14'}px;color:${fuerte ? '#111827' : '#4B5563'};${fuerte ? 'font-weight:bold;' : ''}white-space:nowrap;">${valor}</td>
      </tr>`;

    let filas = fila('Subtotal', formatCentsAsArs(order.subtotalCents));
    if (order.shippingCents) filas += fila('Envío', formatCentsAsArs(order.shippingCents));
    filas += fila('Total', formatCentsAsArs(order.totalCents), true);
    if (order.paymentPlan === 'DEPOSIT_BALANCE') {
      filas += fila('Seña abonada', formatCentsAsArs(order.dueTodayCents));
      if (order.balanceCents) filas += fila('Saldo pendiente', formatCentsAsArs(order.balanceCents));
    }
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${filas}</table>`;
  }

  private renderDetalle(order: OrderMail): string {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
        ${order.items.map((i) => this.renderItem(i)).join('')}
      </table>
      ${this.renderTotales(order)}
      <div style="margin-top:22px;padding-top:16px;border-top:1px solid #E5E7EB;">
        ${this.renderEnvio(order)}
      </div>`;
  }

  /** Confirmación al cliente. Se manda recién cuando el pago está aprobado. */
  async sendOrderConfirmation(order: OrderMail) {
    const { subject, html } = await this.templates.render('ORDER_CONFIRMATION', {
      nombre: order.contactName,
      numero_pedido: order.displayNumber,
      total: formatCentsAsArs(order.totalCents),
      monto_pagado: formatCentsAsArs(order.dueTodayCents),
      saldo:
        order.paymentPlan === 'DEPOSIT_BALANCE' && order.balanceCents
          ? formatCentsAsArs(order.balanceCents)
          : '',
      detalle_pedido: this.renderDetalle(order),
    });
    await this.send({ to: order.contactEmail, subject, html });
  }

  /** Aviso al dueño. Mismo detalle que ve el cliente, más los datos de contacto. */
  async sendSaleAlert(order: OrderMail, eventLabel: string) {
    const { subject, html } = await this.templates.render('SALE_ALERT', {
      evento: eventLabel,
      numero_pedido: order.displayNumber,
      cliente: order.contactName,
      email: order.contactEmail,
      telefono: order.contactPhone ?? '—',
      plan: order.paymentPlan === 'FULL' ? 'Pago total' : 'Seña + saldo',
      total: formatCentsAsArs(order.totalCents),
      detalle_pedido: this.renderDetalle(order),
    });
    await this.send({ to: this.notificationEmail, subject, html });
  }

  /** Aviso de que llegó el pedido y hay que pagar el saldo + envío. */
  async sendBalanceRequest(ctx: BalanceMailContext) {
    const { subject, html } = await this.templates.render('BALANCE_REQUEST', {
      nombre: ctx.contactName,
      numero_pedido: ctx.displayNumber,
      saldo: formatCentsAsArs(ctx.balanceCents),
      envio: formatCentsAsArs(ctx.shippingCents),
      total: formatCentsAsArs(ctx.amountCents),
      link: ctx.url,
      vence: ctx.expiresAt.toLocaleDateString('es-AR'),
    });
    await this.send({ to: ctx.contactEmail, subject, html });
  }

  async sendBalanceReminder(ctx: BalanceMailContext, daysLeft: number) {
    const { subject, html } = await this.templates.render('BALANCE_REMINDER', {
      nombre: ctx.contactName,
      numero_pedido: ctx.displayNumber,
      total: formatCentsAsArs(ctx.amountCents),
      link: ctx.url,
      dias_restantes:
        daysLeft > 0 ? `Te quedan ${daysLeft} día(s) antes de que venza el link.` : 'El link está por vencer.',
    });
    await this.send({ to: ctx.contactEmail, subject, html });
  }

  async sendEmailVerificationCode(email: string, code: string) {
    // El email va en la query para que la pantalla llegue con ese campo ya
    // completo y el cliente solo tenga que pegar el código.
    const { subject, html } = await this.templates.render('EMAIL_VERIFICATION', {
      codigo: code,
      link: `${this.storefrontUrl}/verificar?email=${encodeURIComponent(email)}`,
    });
    await this.send({ to: email, subject, html });
  }

  /** Código para restablecer la contraseña. */
  async sendPasswordResetCode(email: string, code: string) {
    const { subject, html } = await this.templates.render('PASSWORD_RESET', { codigo: code });
    await this.send({ to: email, subject, html });
  }

  /** Recordatorio de carrito abandonado con link para retomar la compra. */
  async sendAbandonedCart(ctx: {
    contactName: string | null;
    contactEmail: string;
    itemCount: number;
    productNames: string[];
    recoveryUrl: string;
  }) {
    const { subject, html } = await this.templates.render('ABANDONED_CART', {
      nombre: ctx.contactName ?? 'hola',
      cantidad: String(ctx.itemCount),
      productos: ctx.productNames.join(', '),
      link: ctx.recoveryUrl,
    });
    await this.send({ to: ctx.contactEmail, subject, html });
  }

  async sendShipmentNotification(ctx: {
    contactName: string;
    contactEmail: string;
    number: number;
    provider: string;
    trackingNumber: string;
  }) {
    const { subject, html } = await this.templates.render('SHIPMENT', {
      nombre: ctx.contactName,
      numero_pedido: formatOrderNumber(ctx.number),
      correo: ctx.provider,
      seguimiento: ctx.trackingNumber,
    });
    await this.send({ to: ctx.contactEmail, subject, html });
  }

  /**
   * Estado del correo para `GET /health`. No expone direcciones ni asuntos: el
   * endpoint es público y esto sólo tiene que alcanzar para notar que algo dejó
   * de andar, no para auditar qué se mandó.
   */
  getMailHealth() {
    return {
      status: this.consecutiveFailures === 0 ? ('ok' as const) : ('failing' as const),
      consecutiveFailures: this.consecutiveFailures,
      lastFailureAt: this.lastFailureAt?.toISOString() ?? null,
      lastFailureReason: this.lastFailureReason,
      lastSuccessAt: this.lastSuccessAt?.toISOString() ?? null,
    };
  }

  private async send(message: { to: string; subject: string; html: string }) {
    try {
      await this.transporter.sendMail({ from: this.from, ...message });
      this.consecutiveFailures = 0;
      this.lastSuccessAt = new Date();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.consecutiveFailures += 1;
      this.lastFailureAt = new Date();
      this.lastFailureReason = reason;
      this.logger.error(
        `No se pudo enviar el email a ${message.to} (fallo ${this.consecutiveFailures} seguido)`,
        error instanceof Error ? error.stack : error,
      );
      await this.recordFailure(message, reason);
    }
  }

  /**
   * Deja el fallo escrito en `audit_logs`. Los logs del contenedor se pierden al
   * recrearlo, y son justo lo que nadie mira; en la base queda consultable.
   *
   * Es best-effort a propósito: si además falla la escritura, se registra y se
   * sigue. Este método corre dentro del `catch` de un envío que ya falló, y
   * dejarlo tirar excepción rompería la operación que lo llamó (un registro, un
   * pedido) por no poder anotar el problema.
   */
  private async recordFailure(message: { to: string; subject: string }, reason: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: 'MAIL_SEND_FAILED',
          entityType: 'Mail',
          metadata: {
            to: message.to,
            subject: message.subject,
            reason,
            consecutiveFailures: this.consecutiveFailures,
          },
        },
      });
    } catch (error) {
      this.logger.error('Tampoco se pudo registrar el fallo de email', error instanceof Error ? error.stack : error);
    }
  }
}
