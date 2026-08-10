import { Module } from '@nestjs/common';

import { MailService } from './mail.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  controllers: [PushController],
  providers: [MailService, PushService],
  exports: [MailService, PushService],
})
export class NotificationsModule {}
