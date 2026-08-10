import { Controller, Get, Header, Param } from '@nestjs/common';
import { ProductionSheetService } from './production-sheet.service';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin')
export class ProductionSheetController {
  constructor(private readonly productionSheet: ProductionSheetService) {}

  @Public() // Accessible for printing
  @Get('batches/:id/production-sheet')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getBatchSheet(@Param('id') id: string) {
    return this.productionSheet.generateBatchSheetHtml(id);
  }

  @Public() // Accessible for printing
  @Get('orders/:id/receipt')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getOrderReceipt(@Param('id') id: string) {
    return this.productionSheet.generateOrderReceiptHtml(id);
  }
}
