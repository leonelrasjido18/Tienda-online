import { Body, Controller, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common';
import { ORDER_FINANCIAL_STATUSES } from '@tienda/shared';
import {
  cancelOrderSchema,
  createShipmentSchema,
  refundOrderSchema,
  type CancelOrderInput,
  type CreateShipmentInput,
  type RefundOrderInput,
  updateShipmentSchema,
  type UpdateShipmentInput,
} from '@tienda/shared';
import { z } from 'zod';

import { OrdersService } from './orders.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

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

  @Post(':id/cancel')
  @UsePipes(new ZodValidationPipe(cancelOrderSchema))
  cancel(@Param('id') id: string, @Body() body: CancelOrderInput) {
    return this.orders.cancel(id, body.reason);
  }

  @Post(':id/refund')
  @UsePipes(new ZodValidationPipe(refundOrderSchema))
  refund(@Param('id') id: string, @Body() body: RefundOrderInput) {
    return this.orders.refund(id, body);
  }

  @Post(':id/shipment')
  @UsePipes(new ZodValidationPipe(createShipmentSchema))
  createShipment(@Param('id') id: string, @Body() body: CreateShipmentInput) {
    return this.orders.createShipment(id, body);
  }

  @Patch(':id/shipment')
  @UsePipes(new ZodValidationPipe(updateShipmentSchema))
  updateShipment(@Param('id') id: string, @Body() body: UpdateShipmentInput) {
    return this.orders.updateShipment(id, body);
  }
}
