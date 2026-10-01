import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import {
  customerLoginSchema,
  customerRegisterSchema,
  customerRequestResetSchema,
  customerResendVerificationSchema,
  customerResetPasswordSchema,
  customerVerifyEmailSchema,
  customerProfileUpdateSchema,
  type CustomerLoginInput,
  type CustomerRegisterInput,
  type CustomerRequestResetInput,
  type CustomerResendVerificationInput,
  type CustomerResetPasswordInput,
  type CustomerVerifyEmailInput,
  type CustomerProfileUpdateInput,
} from '@tienda/shared';
import type { Response, Request } from 'express';

import type { Env } from '../../config/env.validation';
import { Public } from '../../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TurnstileGuard } from '../../common/turnstile/turnstile.guard';
import { CustomersAuthService } from './customers-auth.service';
import { CustomerJwtGuard } from './customer-jwt.guard';
import type { CustomerPrincipal } from './customer-jwt.strategy';

const CUSTOMER_COOKIE_NAME = 'customer_token';
const CART_COOKIE_NAME = 'cart_token';
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

@Controller('customers/auth')
export class CustomersAuthController {
  constructor(
    private readonly authService: CustomersAuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(TurnstileGuard)
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Req() req: Request,
    @Body(new ZodValidationPipe(customerRegisterSchema)) body: CustomerRegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionToken = req.cookies?.[CART_COOKIE_NAME] as string | undefined;
    const result = await this.authService.register({ ...body, sessionToken });
    this.setSessionCookie(res, result.token);
    return { success: true, customer: result.customer };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(TurnstileGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(customerLoginSchema)) body: CustomerLoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sessionToken = req.cookies?.[CART_COOKIE_NAME] as string | undefined;
    const result = await this.authService.login({ ...body, sessionToken });
    this.setSessionCookie(res, result.token);
    return { success: true, customer: result.customer };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodValidationPipe(customerVerifyEmailSchema)) body: CustomerVerifyEmailInput) {
    return this.authService.verifyEmail(body.email, body.code);
  }

  /**
   * Reenvío del código. El límite es más bajo que el de `verify-email` porque
   * acá cada llamada manda un mail: sin freno sirve para inundarle la casilla a
   * cualquiera con solo saber su dirección.
   */
  @Public()
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UseGuards(TurnstileGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body(new ZodValidationPipe(customerResendVerificationSchema)) body: CustomerResendVerificationInput,
  ) {
    return this.authService.resendVerificationCode(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(TurnstileGuard)
  @Post('request-reset')
  @HttpCode(HttpStatus.OK)
  async requestReset(@Body(new ZodValidationPipe(customerRequestResetSchema)) body: CustomerRequestResetInput) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodValidationPipe(customerResetPasswordSchema)) body: CustomerResetPasswordInput) {
    return this.authService.resetPassword(body.email, body.code, body.newPassword);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(CUSTOMER_COOKIE_NAME, { path: '/' });
    return { success: true };
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('me')
  async getMe(@Req() req: Request) {
    const user = req.user as CustomerPrincipal;
    const profile = await this.authService.getCustomerProfile(user.id);
    return { customer: profile };
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Patch('me/profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @Req() req: Request,
    @Body(new ZodValidationPipe(customerProfileUpdateSchema)) body: CustomerProfileUpdateInput,
  ) {
    const user = req.user as CustomerPrincipal;
    const profile = await this.authService.updateCustomerProfile(user.id, body);
    return { success: true, customer: profile };
  }

  @Public()
  @UseGuards(CustomerJwtGuard)
  @Get('me/orders')
  async getOrders(@Req() req: Request) {
    const user = req.user as CustomerPrincipal;
    const orders = await this.authService.getCustomerOrders(user.id);
    return { orders };
  }

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    });
  }
}
