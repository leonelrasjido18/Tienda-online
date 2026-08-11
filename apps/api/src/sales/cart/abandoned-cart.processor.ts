import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { ABANDONED_CART_QUEUE } from './abandoned-cart.constants';
import { AbandonedCartService } from './abandoned-cart.service';

const SCAN_EVERY_MS = 30 * 60 * 1000; // cada 30 minutos

@Processor(ABANDONED_CART_QUEUE)
export class AbandonedCartProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AbandonedCartProcessor.name);

  constructor(
    @InjectQueue(ABANDONED_CART_QUEUE) private readonly queue: Queue,
    private readonly service: AbandonedCartService,
  ) {
    super();
  }

  /** Registra el barrido periódico. El repeat key hace que sea idempotente. */
  async onModuleInit() {
    await this.queue.add(
      'scan',
      {},
      { repeat: { every: SCAN_EVERY_MS }, removeOnComplete: true, removeOnFail: 50 },
    );
  }

  async process(job: Job) {
    this.logger.log(`Barrido de carritos abandonados (job: ${job.id})`);
    return this.service.run();
  }
}
