import { Module } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';
import { TurnstileGuard } from './turnstile.guard';

@Module({
  providers: [TurnstileService, TurnstileGuard],
  exports: [TurnstileService, TurnstileGuard],
})
export class TurnstileModule {}
