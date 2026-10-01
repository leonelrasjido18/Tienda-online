import { Controller, Get, Header, Param } from '@nestjs/common';
import { ProductionSheetService } from './production-sheet.service';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Hojas de producción y recibos en HTML, pensados para imprimir desde el panel.
 *
 * Los dos endpoints tenían `@Public()` con el comentario "accessible for
 * printing", pero eso no los hacía accesibles: `@Public()` saltea el guard de
 * JWT, así que `request.user` quedaba vacío y el `@Roles` de esta clase
 * respondía 403 a todo el mundo, sesión válida incluida. Se saca el decorador y
 * quedan como el resto de `/admin`: hay que estar logueado como OWNER o STAFF.
 */
@Roles('OWNER', 'STAFF')
@Controller('admin')
export class ProductionSheetController {
  constructor(private readonly productionSheet: ProductionSheetService) {}

  @Get('batches/:id/production-sheet')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getBatchSheet(@Param('id') id: string) {
    return this.productionSheet.generateBatchSheetHtml(id);
  }

  @Get('orders/:id/receipt')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getOrderReceipt(@Param('id') id: string) {
    return this.productionSheet.generateOrderReceiptHtml(id);
  }
}
