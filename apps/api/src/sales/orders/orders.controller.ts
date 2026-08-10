import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../auth/decorators/public.decorator';
import { OrdersService } from './orders.service';

@Public()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':token')
  detail(@Param('token') token: string) {
    return this.orders.publicDetail(token);
  }
}
