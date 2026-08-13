import { Controller, Get } from '@nestjs/common';
import type { ActivePreorderWindowDto } from '@tienda/shared';

import { Public } from '../auth/decorators/public.decorator';
import { BatchesService } from './batches.service';

/** Ventana de encargo activa para la cuenta regresiva del storefront. */
@Public()
@Controller('preorder')
export class PublicPreorderController {
  constructor(private readonly batches: BatchesService) {}

  @Get('window')
  window(): Promise<ActivePreorderWindowDto | null> {
    return this.batches.getActiveWindow();
  }
}
