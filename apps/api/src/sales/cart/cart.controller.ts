import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res, UsePipes } from '@nestjs/common';
import { addCartItemSchema, updateCartItemSchema, type AddCartItemInput, type UpdateCartItemInput } from '@tienda/shared';
import type { Request, Response } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CartService } from './cart.service';

const CART_COOKIE_NAME = 'cart_token';
const CART_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cart = await this.resolveCart(req, res);
    return this.cart.getCartDto(cart.id);
  }

  @Post('items')
  @UsePipes(new ZodValidationPipe(addCartItemSchema))
  async addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: AddCartItemInput,
  ) {
    const cart = await this.resolveCart(req, res);
    return this.cart.addItem(cart.id, body);
  }

  @Patch('items/:itemId')
  @UsePipes(new ZodValidationPipe(updateCartItemSchema))
  async updateItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('itemId') itemId: string,
    @Body() body: UpdateCartItemInput,
  ) {
    const cart = await this.resolveCart(req, res);
    return this.cart.updateItemQuantity(cart.id, itemId, body.quantity);
  }

  @Delete('items/:itemId')
  async removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('itemId') itemId: string,
  ) {
    const cart = await this.resolveCart(req, res);
    return this.cart.removeItem(cart.id, itemId);
  }

  private async resolveCart(req: Request, res: Response) {
    const token = req.cookies?.[CART_COOKIE_NAME] as string | undefined;
    const existing = await this.cart.findValidCart(token);
    if (existing) return existing;

    const created = await this.cart.createCart();
    res.cookie(CART_COOKIE_NAME, created.sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: CART_COOKIE_MAX_AGE_MS,
    });
    return created;
  }
}
