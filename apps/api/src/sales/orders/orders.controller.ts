import { Controller, Get, Param } from '@nestjs/common';

import { Public } from '../../auth/decorators/public.decorator';
import { OrdersService } from './orders.service';

@Public()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }
}
