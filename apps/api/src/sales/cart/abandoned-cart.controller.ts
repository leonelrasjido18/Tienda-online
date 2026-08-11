import { Controller, Post } from '@nestjs/common';

import { Roles } from '../../auth/decorators/roles.decorator';
import { AbandonedCartService } from './abandoned-cart.service';

@Roles('OWNER', 'STAFF')
@Controller('admin/abandoned-carts')
export class AbandonedCartController {
  constructor(private readonly service: AbandonedCartService) {}

  /** Disparo manual del barrido, sin esperar al job periódico. */
  @Post('run')
  run() {
    return this.service.run();
  }
}
