import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  CustomerLoginInput,
  CustomerProfileUpdateInput,
  CustomerRegisterInput,
} from '@tienda/shared';
import bcrypt from 'bcryptjs';
import type { Customer } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { CartService } from '../cart/cart.service';

const CODE_TTL_MS = 30 * 60 * 1000; // 30 minutos
const REFERRAL_REWARD_CENTS = 100000; // $1000 ARS

type CustomerSummary = { id: string; email: string; name: string | null; emailVerified: boolean };

@Injectable()
export class CustomersAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jwtService: JwtService,
    private readonly cartService: CartService,
  ) {}

  /**
   * Registro con email + contraseña. Si ya existe una cuenta con contraseña para
   * ese email, se rechaza; si existe una cuenta sin contraseña (creada antes), se
   * la reclama seteándole la clave. Envía un código para verificar el email, pero
   * la sesión se abre igual (la verificación queda como paso confirmable aparte).
   */
  async register(input: CustomerRegisterInput): Promise<{ token: string; customer: CustomerSummary }> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing?.passwordHash) {
      throw new BadRequestException('Ya existe una cuenta con este email. Iniciá sesión o restablecé tu contraseña.');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    let customer: Customer;
    if (existing) {
      customer = await this.prisma.customer.update({
        where: { id: existing.id },
        data: { passwordHash, name: input.name ?? existing.name },
      });
    } else {
      const referredById = input.referredByCode
        ? (await this.prisma.customer.findUnique({ where: { referralCode: input.referredByCode.trim() } }))?.id ?? null
        : null;

      customer = await this.prisma.customer.create({
        data: {
          email,
          name: input.name ?? null,
          passwordHash,
          referralCode: this.generateReferralCode(email),
          referredById,
        },
      });

      if (referredById) {
        await this.prisma.referralReward.create({
          data: { referrerId: referredById, referredId: customer.id, rewardCents: REFERRAL_REWARD_CENTS, status: 'PENDING' },
        });
      }
    }

    await this.issueVerificationCode(email);

    if (input.sessionToken) {
      await this.cartService.mergeAnonymousCartWithCustomer(input.sessionToken, customer.id);
    }

    return { token: this.signToken(customer), customer: this.toSummary(customer) };
  }

  /** Login por email + contraseña. Mensaje genérico para no filtrar si el email existe. */
  async login(input: CustomerLoginInput): Promise<{ token: string; customer: CustomerSummary }> {
    const email = input.email.toLowerCase().trim();
    const customer = await this.prisma.customer.findUnique({ where: { email } });

    if (!customer || !customer.passwordHash) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }
    const matches = await bcrypt.compare(input.password, customer.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Email o contraseña incorrectos');
    }

    if (input.sessionToken) {
      await this.cartService.mergeAnonymousCartWithCustomer(input.sessionToken, customer.id);
    }

    return { token: this.signToken(customer), customer: this.toSummary(customer) };
  }

  /** Verifica el email con el código enviado al registrarse. */
  async verifyEmail(email: string, code: string): Promise<{ success: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const record = await this.consumeCode(normalizedEmail, code, 'VERIFY_EMAIL');
    if (!record) {
      throw new BadRequestException('Código inválido o vencido');
    }
    await this.prisma.customer.updateMany({
      where: { email: normalizedEmail },
      data: { emailVerifiedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Reenvía el código de verificación. El del registro dura 30 minutos, así que
   * el cliente que abre el mail al día siguiente necesita pedir otro.
   *
   * Responde siempre lo mismo, igual que `requestPasswordReset`: si dijera
   * "ese email no existe" o "ya está verificado", serviría para averiguar qué
   * direcciones tienen cuenta acá.
   */
  async resendVerificationCode(email: string): Promise<{ success: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const customer = await this.prisma.customer.findUnique({ where: { email: normalizedEmail } });
    // Al ya verificado no se le manda nada: sería un mail inútil y un vector
    // para molestar a alguien pidiendo su código una y otra vez.
    if (customer && customer.emailVerifiedAt === null) {
      await this.issueVerificationCode(normalizedEmail);
    }
    return { success: true };
  }

  /**
   * Pide un código de restablecimiento. Siempre responde igual, exista o no la
   * cuenta, para no revelar qué emails están registrados.
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const customer = await this.prisma.customer.findUnique({ where: { email: normalizedEmail } });
    if (customer) {
      const code = this.randomCode();
      await this.prisma.customerAuthCode.create({
        data: { email: normalizedEmail, code, type: 'RESET_PASSWORD', expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      });
      await this.mail.sendPasswordResetCode(normalizedEmail, code);
    }
    return { success: true };
  }

  /** Restablece la contraseña usando el código de reset. */
  async resetPassword(email: string, code: string, newPassword: string): Promise<{ success: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const record = await this.consumeCode(normalizedEmail, code, 'RESET_PASSWORD');
    if (!record) {
      throw new BadRequestException('Código inválido o vencido');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.customer.updateMany({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });
    return { success: true };
  }

  /** Perfil para "Mi cuenta". Selección explícita: NUNCA devolver `passwordHash`. */
  async getCustomerProfile(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        emailVerifiedAt: true,
        defaultPickupInStore: true,
        defaultStreet: true,
        defaultNumber: true,
        defaultFloor: true,
        defaultCity: true,
        defaultProvince: true,
        defaultPostalCode: true,
        defaultNotes: true,
        referralCode: true,
        referralBalanceCents: true,
      },
    });
  }

  async updateCustomerProfile(id: string, data: CustomerProfileUpdateInput) {
    await this.prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        defaultPickupInStore: data.defaultPickupInStore ?? false,
        defaultStreet: data.defaultStreet ?? null,
        defaultNumber: data.defaultNumber ?? null,
        defaultFloor: data.defaultFloor ?? null,
        defaultCity: data.defaultCity ?? null,
        defaultProvince: data.defaultProvince ?? null,
        defaultPostalCode: data.defaultPostalCode ?? null,
        defaultNotes: data.defaultNotes ?? null,
      },
    });
    // Se devuelve la proyección segura (sin passwordHash), igual que el GET.
    return this.getCustomerProfile(id);
  }

  async getCustomerOrders(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      include: { items: true, payments: true, importBatch: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- privados -----------------------------------------------------------

  private async issueVerificationCode(email: string): Promise<void> {
    const code = this.randomCode();
    await this.prisma.customerAuthCode.create({
      data: { email, code, type: 'VERIFY_EMAIL', expiresAt: new Date(Date.now() + CODE_TTL_MS) },
    });
    await this.mail.sendEmailVerificationCode(email, code);
  }

  /** Busca un código válido y no usado del tipo pedido y lo marca usado. */
  private async consumeCode(email: string, code: string, type: 'VERIFY_EMAIL' | 'RESET_PASSWORD') {
    const record = await this.prisma.customerAuthCode.findFirst({
      where: { email, code: code.trim(), type, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) return null;
    await this.prisma.customerAuthCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return record;
  }

  private signToken(customer: Customer): string {
    return this.jwtService.sign({ sub: customer.id, email: customer.email, role: 'CUSTOMER' });
  }

  private toSummary(customer: Customer): CustomerSummary {
    return { id: customer.id, email: customer.email, name: customer.name, emailVerified: customer.emailVerifiedAt !== null };
  }

  private randomCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateReferralCode(email: string): string {
    const prefix = (email.split('@')[0] ?? 'USER').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'USER';
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${suffix}`;
  }
}
