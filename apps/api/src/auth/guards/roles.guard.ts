import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { StaffRole } from '@tienda/shared';

import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class RolesGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const declaredRoles = this.reflector.getAllAndOverride<StaffRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<{ originalUrl?: string; user?: AuthenticatedUser }>();
    // Todo endpoint bajo /admin queda protegido aun si alguien olvida anotar el
    // controlador. Los permisos más granulares se declaran explícitamente con
    // @Roles cuando se incorporen nuevos perfiles.
    const requiredRoles = declaredRoles ?? (request.originalUrl?.startsWith('/admin/') ? ['OWNER'] : undefined);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tenés permisos para esta acción');
    }

    return true;
  }
}
