import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { formatOrderNumber, type PaymentStatus } from '@tienda/shared';
import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Payment,
  PaymentRefund,
  Preference,
  WebhookSignatureValidator,
} from 'mercadopago';

import type { Env } from '../../config/env.validation';
import type {
  CreateCheckoutInput,
  CreatedCheckout,
  PaymentProvider,
  ResolvedWebhook,
  WebhookContext,
} from './payment-provider.interface';

export type CreatePreferenceInput = CreateCheckoutInput;

@Injectable()
export class MercadoPagoService implements PaymentProvider {
  readonly name = 'mercadopago' as const;
  private readonly client: MercadoPagoConfig | null;
  private readonly webhookSecret: string;
  private readonly storefrontUrl: string;
  private readonly apiPublicUrl: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    const accessToken = this.config.get('MP_ACCESS_TOKEN');
    this.client = accessToken ? new MercadoPagoConfig({ accessToken }) : null;
    this.webhookSecret = this.config.get('MP_WEBHOOK_SECRET');
    this.storefrontUrl = this.config.get('STOREFRONT_URL');
    this.apiPublicUrl = this.config.get('API_PUBLIC_URL');
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): MercadoPagoConfig {
    if (!this.client) {
      throw new BadRequestException('Mercado Pago no está configurado en este ambiente');
    }
    return this.client;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    const { preferenceId, initPoint } = await this.createPreference(input);
    return { providerRef: preferenceId, redirectUrl: initPoint };
  }

  /**
   * Mercado Pago sí firma sus webhooks: se valida la firma HMAC y, además, se
   * reconsulta el pago contra su API en vez de confiar en el cuerpo del POST.
   */
  async resolveWebhook(ctx: WebhookContext): Promise<ResolvedWebhook | null> {
    const body = (ctx.body ?? {}) as { type?: string; data?: { id?: string } };
    const type = ctx.query.type ?? body.type;
    const dataId = ctx.query['data.id'] ?? body.data?.id;

    if (type !== 'payment' || !dataId) {
      return null;
    }

    const requestId = ctx.headers['x-request-id'];
    const signature = ctx.headers['x-signature'];
    this.verifySignature(
      {
        xSignature: typeof signature === 'string' ? signature : undefined,
        xRequestId: typeof requestId === 'string' ? requestId : undefined,
      },
      dataId,
    );

    const mpPayment = await this.getPayment(dataId);
    if (!mpPayment.external_reference || !mpPayment.status) {
      return null;
    }

    return {
      eventId: `${typeof requestId === 'string' ? requestId : 'no-request-id'}:${dataId}`,
      paymentId: mpPayment.external_reference,
      status: this.mapStatus(mpPayment.status),
      providerPaymentId: String(mpPayment.id),
      raw: mpPayment,
    };
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'approved':
        return 'APPROVED';
      case 'rejected':
        return 'REJECTED';
      case 'refunded':
      case 'charged_back':
        return 'REFUNDED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return 'PENDING';
    }
  }

  async createPreference(input: CreatePreferenceInput): Promise<{ preferenceId: string; initPoint: string }> {
    const preference = new Preference(this.requireClient());
    const displayNumber = formatOrderNumber(input.orderNumber);

    const result = await preference.create({
      body: {
        items: [
          {
            id: input.orderId,
            title: `Pedido ${displayNumber} — ${input.kindLabel}`,
            quantity: 1,
            unit_price: input.amountCents / 100,
            currency_id: 'ARS',
          },
        ],
        external_reference: input.paymentId,
        back_urls: {
          success: `${this.storefrontUrl}/pedido/${input.orderId}?estado=aprobado`,
          failure: `${this.storefrontUrl}/pedido/${input.orderId}?estado=rechazado`,
          pending: `${this.storefrontUrl}/pedido/${input.orderId}?estado=pendiente`,
        },
        auto_return: 'approved',
        notification_url: `${this.apiPublicUrl}/payments/mercadopago/webhook`,
      },
    });

    if (!result.id || !result.init_point) {
      throw new BadRequestException('Mercado Pago no devolvió una preferencia válida');
    }

    return { preferenceId: result.id, initPoint: result.init_point };
  }

  async getPayment(paymentId: string) {
    const payment = new Payment(this.requireClient());
    return payment.get({ id: paymentId });
  }

  async refund(providerPaymentId: string, amountCents: number): Promise<{ providerRefundId: string; status: PaymentStatus }> {
    const refund = new PaymentRefund(this.requireClient());
    try {
      const result = await refund.create({
        payment_id: providerPaymentId,
        body: {
          amount: amountCents / 100,
        },
      });

      if (!result.id) {
        throw new BadRequestException('Mercado Pago no devolvió un ID de reembolso válido');
      }

      return {
        providerRefundId: String(result.id),
        status: 'APPROVED',
      };
    } catch (error) {
      this.requireClient(); // ensures it throws if not configured
      throw new BadRequestException(
        `Error al reembolsar con Mercado Pago: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  verifySignature(headers: { xSignature?: string; xRequestId?: string }, dataId: string) {
    if (!this.webhookSecret) return;

    try {
      WebhookSignatureValidator.validate({
        xSignature: headers.xSignature,
        xRequestId: headers.xRequestId,
        dataId,
        secret: this.webhookSecret,
      });
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) {
        throw new UnauthorizedException('Firma de webhook inválida');
      }
      throw error;
    }
  }
}
