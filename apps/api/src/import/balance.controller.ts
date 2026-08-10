import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CHECKOUT_PAYMENT_METHODS, type CheckoutPaymentMethod } from '@tienda/shared';

import { Public } from '../auth/decorators/public.decorator';
import { BalanceService } from './balance.service';

@Public()
@Controller('balance')
export class BalanceController {
  constructor(private readonly balance: BalanceService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.balance.getByToken(token);
  }

  @Post(':token/pay')
  pay(@Param('token') token: string, @Body('paymentMethod') paymentMethod: string) {
    if (!CHECKOUT_PAYMENT_METHODS.includes(paymentMethod as CheckoutPaymentMethod)) {
      throw new BadRequestException('Método de pago inválido');
    }
    return this.balance.startPayment(token, paymentMethod as CheckoutPaymentMethod);
  }
}
