import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { BALANCE_REMINDERS_QUEUE } from './import-queue.constants';
import { BalanceRemindersService } from './balance-reminders.service';

@Processor(BALANCE_REMINDERS_QUEUE)
export class BalanceRemindersProcessor extends WorkerHost {
  private readonly logger = new Logger(BalanceRemindersProcessor.name);

  constructor(private readonly reminders: BalanceRemindersService) {
    super();
  }

  async process(job: Job<any>) {
    this.logger.log(`Iniciando ejecución de recordatorios de saldo (job: ${job.id})`);
    const result = await this.reminders.run();
    this.logger.log(`Recordatorios finalizados: ${result.reminded} recordatorios enviados, ${result.expired} links vencidos`);
    return result;
  }
}
