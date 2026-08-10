import { Controller, Post } from '@nestjs/common';

import { BalanceRemindersService } from './balance-reminders.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Roles('OWNER', 'STAFF')
@Controller('admin/balance-reminders')
export class BalanceRemindersController {
  constructor(private readonly reminders: BalanceRemindersService) {}

  /** Disparo manual desde el panel, sin esperar al cron diario. */
  @Post('run')
  run() {
    return this.reminders.run();
  }
}
