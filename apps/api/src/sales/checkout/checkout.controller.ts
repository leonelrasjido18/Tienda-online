import { BadRequestException, Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import { createOrderSchema, type CreateOrderInput } from '@tienda/shared';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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

  @Post()
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
