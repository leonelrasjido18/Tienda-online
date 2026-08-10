import { Module } from '@nestjs/common';

import { StockReservationService } from './stock-reservation.service';

@Module({
  providers: [StockReservationService],
  exports: [StockReservationService],
})
export class StockModule {}
