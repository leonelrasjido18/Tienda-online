import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';

import { Public } from '../auth/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../sales/notifications/mail.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde');
    }

    // El correo no tumba el health check: la tienda sigue vendiendo sin poder
    // mandar mails, y devolver 503 haría que el orquestador reinicie el
    // contenedor por algo que un reinicio no arregla. Se informa y listo.
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      mail: this.mail.getMailHealth(),
    };
  }
}
