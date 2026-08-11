import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import type { Env } from '../../config/env.validation';
import { TurnstileModule } from '../../common/turnstile/turnstile.module';
import { CartModule } from '../cart/cart.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CustomersAuthController } from './customers-auth.controller';
import { CustomersAuthService } from './customers-auth.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '7d' }, // La sesión del cliente dura 7 días
      }),
    }),
    NotificationsModule,
    CartModule,
    TurnstileModule,
  ],
  controllers: [CustomersAuthController],
  providers: [CustomersAuthService, CustomerJwtStrategy],
  exports: [CustomersAuthService],
})
export class CustomersAuthModule {}
