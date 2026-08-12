import { Body, Controller, Post, Req, UsePipes } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { publicShippingQuoteSchema, type PublicShippingQuoteInput } from '@tienda/shared';
import type { Request } from 'express';

import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ShippingService } from './shipping.service';

const CART_COOKIE_NAME = 'cart_token';

/** Cotización en vivo para el storefront: el cliente escribe el CP y ve el precio. */
@Public()
@Controller('shipping')
export class PublicShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post('quote')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UsePipes(new ZodValidationPipe(publicShippingQuoteSchema))
  quote(@Req() req: Request, @Body() body: PublicShippingQuoteInput) {
    const token = req.cookies?.[CART_COOKIE_NAME] as string | undefined;
    return this.shipping.quoteForCart(token, {
      postalCode: body.postalCode,
      province: body.province ?? null,
      city: body.city ?? null,
    });
  }
}
