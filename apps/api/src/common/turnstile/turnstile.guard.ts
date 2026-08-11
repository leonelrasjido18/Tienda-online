import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

@Injectable()
export class TurnstileGuard implements CanActivate {
  constructor(private readonly turnstile: TurnstileService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-turnstile-token'] as string | undefined;
    const ip = request.ip;

    const isValid = await this.turnstile.verify(token, ip);
    if (!isValid) {
      throw new BadRequestException('Verificación de CAPTCHA fallida. Intente nuevamente.');
    }

    return true;
  }
}
