import { Module } from '@nestjs/common';

import { OrdersModule } from '../orders/orders.module';
import { MercadoPagoService } from './mercadopago.service';
import { PaymentProviderRegistry } from './payment-provider.registry';
import { PaymentsController } from './payments.controller';
import { UalaService } from './uala.service';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [MercadoPagoService, UalaService, PaymentProviderRegistry],
  exports: [PaymentProviderRegistry],
})
export class PaymentsModule {}
