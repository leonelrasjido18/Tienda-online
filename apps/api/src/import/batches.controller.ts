import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UsePipes } from '@nestjs/common';
import {
  advanceImportBatchSchema,
  assignOrdersSchema,
  createImportBatchSchema,
  markBalancePaidSchema,
  updateImportBatchSchema,
  type AdvanceImportBatchInput,
  type AssignOrdersInput,
  type CreateImportBatchInput,
  type MarkBalancePaidInput,
  type UpdateImportBatchInput,
} from '@tienda/shared';

import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { BalanceService } from './balance.service';
import { BatchesService } from './batches.service';

@Controller('admin/batches')
export class BatchesController {
  constructor(
    private readonly batches: BatchesService,
    private readonly balance: BalanceService,
  ) {}

  @Get()
  list() {
    return this.batches.list();
  }

  /** Pedidos por encargo listos para sumar a un lote. */
  @Get('assignable-orders')
  assignableOrders() {
    return this.batches.assignableOrders();
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.batches.detail(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(createImportBatchSchema))
  create(@Body() body: CreateImportBatchInput) {
    return this.batches.create(body);
  }

  @Put(':id')
  @UsePipes(new ZodValidationPipe(updateImportBatchSchema))
  update(@Param('id') id: string, @Body() body: UpdateImportBatchInput) {
    return this.batches.update(id, body);
  }

  @Post(':id/orders')
  @UsePipes(new ZodValidationPipe(assignOrdersSchema))
  assignOrders(@Param('id') id: string, @Body() body: AssignOrdersInput) {
    return this.batches.assignOrders(id, body.orderIds);
  }

  @Delete(':id/orders/:orderId')
  removeOrder(@Param('id') id: string, @Param('orderId') orderId: string) {
    return this.batches.removeOrder(id, orderId);
  }

  @Patch(':id/status')
  @UsePipes(new ZodValidationPipe(advanceImportBatchSchema))
  advance(@Param('id') id: string, @Body() body: AdvanceImportBatchInput) {
    return this.batches.advance(id, body.status);
  }

  /** Marca manual del saldo (transferencia recibida por fuera del sistema). */
  @Post('orders/:orderId/mark-balance-paid')
  @UsePipes(new ZodValidationPipe(markBalancePaidSchema))
  markBalancePaid(@Param('orderId') orderId: string, @Body() body: MarkBalancePaidInput) {
    return this.balance.markPaidManually(orderId, body.note);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.batches.remove(id);
  }
}
