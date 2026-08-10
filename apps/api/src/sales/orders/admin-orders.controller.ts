import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ORDER_FINANCIAL_STATUSES } from '@tienda/shared';
import { z } from 'zod';

import { OrdersService } from './orders.service';

const adminListQuerySchema = z.object({
  financialStatus: z.enum(ORDER_FINANCIAL_STATUSES).optional(),
  q: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(24),
});

@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@Query() query: Record<string, string>) {
    const parsed = adminListQuerySchema.parse(query);
    return this.orders.list(parsed);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.orders.detail(id);
  }

  @Post(':id/payments/:paymentId/approve-transfer')
  approveTransfer(@Param('id') id: string, @Param('paymentId') paymentId: string) {
    return this.orders.approveBankTransfer(id, paymentId);
  }
}
