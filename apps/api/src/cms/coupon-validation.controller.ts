import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UsePipes,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { validateCouponSchema, type ValidateCouponInput } from '@tienda/shared';

import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@Controller('coupons')
export class CouponValidationController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Valida un cupón para el checkout. Devuelve el descuento calculado
   * sin consumir el cupón (eso se hace al confirmar la orden).
   */
  @Public()
  // Mas estricto que el limite global (100/min): este endpoint dice si un codigo
  // existe, asi que sin freno propio sirve para tantear codigos de descuento.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(validateCouponSchema))
  async validateCoupon(@Body() body: ValidateCouponInput) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: body.code.toUpperCase().trim() },
    });

    if (!coupon) {
      throw new BadRequestException('El código de cupón no existe.');
    }

    if (!coupon.isActive) {
      throw new BadRequestException('Este cupón ya no está vigente.');
    }

    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException('Este cupón ha expirado.');
    }

    if (coupon.maxUses !== null && coupon.uses >= coupon.maxUses) {
      throw new BadRequestException('Este cupón ya alcanzó el límite de usos.');
    }

    if (body.subtotalCents < coupon.minPurchaseCents) {
      const minFormatted = (coupon.minPurchaseCents / 100).toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS',
      });
      throw new BadRequestException(
        `El monto mínimo de compra para este cupón es ${minFormatted}.`,
      );
    }

    // Calcular el descuento
    let discountCents = 0;
    switch (coupon.type) {
      case 'PERCENTAGE':
        discountCents = Math.round((body.subtotalCents * coupon.value) / 100);
        break;
      case 'FIXED_AMOUNT':
        discountCents = Math.min(coupon.value, body.subtotalCents);
        break;
      case 'FREE_SHIPPING':
        discountCents = 0; // Se aplica en envío, no en subtotal
        break;
    }

    return {
      valid: true,
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      discountCents,
      freeShipping: coupon.type === 'FREE_SHIPPING',
    };
  }
}
