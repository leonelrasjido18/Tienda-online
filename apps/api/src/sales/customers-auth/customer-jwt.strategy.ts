import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import type { Env } from '../../config/env.validation';

/** Payload que firmamos en el token del cliente. */
interface CustomerJwtPayload {
  sub: string;
  email: string;
  role: string;
}

/** Lo que queda en `req.user` tras validar el token del cliente. */
export interface CustomerPrincipal {
  id: string;
  email: string;
  role: 'CUSTOMER';
}

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(config: ConfigService<Env, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => {
          return req?.cookies?.['customer_token'] || null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: CustomerJwtPayload): CustomerPrincipal | null {
    if (!payload || payload.role !== 'CUSTOMER') {
      return null;
    }
    return { id: payload.sub, email: payload.email, role: 'CUSTOMER' };
  }
}
