import { BadRequestException, Body, Controller, Param, Post, Req, UseGuards, UsePipes } from '@nestjs/common';
import { createOrderSchema, type CreateOrderInput, retryPaymentSchema, type RetryPaymentInput } from '@tienda/shared';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TurnstileGuard } from '../../common/turnstile/turnstile.guard';
import { CartService } from '../cart/cart.service';
import { CheckoutService } from './checkout.service';

const CART_COOKIE_NAME = 'cart_token';

@Public()
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly cart: CartService,
  ) {}

  @Post(':token/retry')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(TurnstileGuard)
  @UsePipes(new ZodValidationPipe(retryPaymentSchema))
  async retryPayment(@Param('token') token: string, @Body() body: RetryPaymentInput) {
    return this.checkout.retryPayment(token, body.paymentMethod);
  }

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @UseGuards(TurnstileGuard)
  @UsePipes(new ZodValidationPipe(createOrderSchema))
  async createOrder(@Req() req: Request, @Body() body: CreateOrderInput) {
    const token = req.cookies?.[CART_COOKIE_NAME] as string | undefined;
    const cart = await this.cart.findValidCart(token);
    if (!cart) {
      throw new BadRequestException('El carrito no existe o expiró');
    }

    return this.checkout.createOrder(cart.id, body);
  }
}
