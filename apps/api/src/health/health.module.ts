import { Module } from '@nestjs/common';

import { NotificationsModule } from '../sales/notifications/notifications.module';
import { HealthController } from './health.controller';

@Module({
  // Por el estado del correo: `send` traga los errores para no tumbar un pedido,
  // así que el health check es el lugar donde un SMTP caído se hace visible.
  imports: [NotificationsModule],
  controllers: [HealthController],
})
export class HealthModule {}
