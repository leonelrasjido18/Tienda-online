import { Module } from '@nestjs/common';

import { EmailTemplatesController } from './email-templates.controller';
import { EmailTemplatesService } from './email-templates.service';
import { MailService } from './mail.service';
import { PushController } from './push.controller';
import { PushService } from './push.service';

@Module({
  controllers: [PushController, EmailTemplatesController],
  providers: [MailService, PushService, EmailTemplatesService],
  exports: [MailService, PushService, EmailTemplatesService],
})
export class NotificationsModule {}
