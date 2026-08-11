import { Body, Controller, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentProviderRegistry } from './payment-provider.registry';

@Public()
@Controller('payments/:provider')
export class PaymentsController {
  constructor(
    private readonly registry: PaymentProviderRegistry,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Webhook común a todas las pasarelas.
   *
   * El orden importa: primero el proveedor valida y **reconsulta** el estado
   * contra su API (nunca se confía en el cuerpo del POST), después se guarda el
   * evento con índice único para que un reintento no lo procese dos veces, y
   * recién entonces se toca la orden.
   */
  @Post('webhook')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async webhook(
    @Param('provider') providerName: string,
    @Req() req: Request,
    @Query() query: Record<string, string>,
    @Body() body: unknown,
  ) {
    const provider = this.registry.byName(providerName);
    if (!provider) {
      throw new NotFoundException('Pasarela desconocida');
    }

    const resolved = await provider.resolveWebhook({ headers: req.headers, query, body });
    if (!resolved) {
      return { received: true };
    }

    try {
      await this.prisma.webhookEvent.create({
        data: {
          provider: provider.name,
          eventId: resolved.eventId,
          payload: (body ?? {}) as Prisma.InputJsonValue,
        },
      });
    } catch {
      // Choque de índice único: ya se procesó este evento.
      return { received: true };
    }

    await this.orders.applyPaymentStatus(resolved.paymentId, {
      provider: provider.name,
      status: resolved.status,
      providerPaymentId: resolved.providerPaymentId,
      amountCents: resolved.amountCents,
      currency: resolved.currency,
      rawPayload: resolved.raw,
    });

    await this.prisma.webhookEvent.update({
      where: { provider_eventId: { provider: provider.name, eventId: resolved.eventId } },
      data: { processedAt: new Date() },
    });

    return { received: true };
  }
}
