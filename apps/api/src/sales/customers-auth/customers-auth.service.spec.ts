import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { Customer, CustomerAuthCode } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { expect, vi, describe, it, beforeEach } from 'vitest';

import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../notifications/mail.service';
import { CartService } from '../cart/cart.service';
import { CustomersAuthService } from './customers-auth.service';

// bcrypt se mockea para que los tests sean rápidos y deterministas.
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async (v: string) => `hashed:${v}`),
    compare: vi.fn(async (v: string, hash: string) => hash === `hashed:${v}`),
  },
}));

const customerRow = (overrides: Partial<Customer> = {}): Customer =>
  ({
    id: 'cust-1',
    email: 'client@messi.com',
    name: 'Leo',
    passwordHash: 'hashed:password123',
    emailVerifiedAt: null,
    referralCode: 'LEO-1234',
    referredById: null,
    ...overrides,
  }) as unknown as Customer;

describe('CustomersAuthService', () => {
  let service: CustomersAuthService;
  let prisma: PrismaService;
  let mail: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersAuthService,
        {
          provide: PrismaService,
          useValue: {
            customerAuthCode: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
            customer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
            referralReward: { create: vi.fn() },
          },
        },
        {
          provide: MailService,
          useValue: {
            sendEmailVerificationCode: vi.fn().mockResolvedValue(undefined),
            sendPasswordResetCode: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: JwtService, useValue: { sign: vi.fn().mockReturnValue('mocked-token') } },
        { provide: CartService, useValue: { mergeAnonymousCartWithCustomer: vi.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    service = module.get(CustomersAuthService);
    prisma = module.get(PrismaService);
    mail = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('crea un cliente nuevo, hashea la contraseña y envía el código de verificación', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(null);
      const createSpy = vi
        .spyOn(prisma.customer, 'create')
        .mockResolvedValue(customerRow({ id: 'cust-new' }));

      const result = await service.register({ email: 'NEW@messi.com', password: 'password123', name: 'Leo' });

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      // Email normalizado a minúsculas y con hash, no en texto plano.
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@messi.com', passwordHash: 'hashed:password123' }) }),
      );
      expect(mail.sendEmailVerificationCode).toHaveBeenCalled();
      expect(result.token).toBe('mocked-token');
      expect(result.customer.emailVerified).toBe(false);
    });

    it('rechaza registrar si ya existe una cuenta con contraseña', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(customerRow());
      await expect(service.register({ email: 'client@messi.com', password: 'password123' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    it('deja entrar con la contraseña correcta', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(customerRow());
      const result = await service.login({ email: 'client@messi.com', password: 'password123' });
      expect(result.token).toBe('mocked-token');
    });

    it('rechaza con contraseña incorrecta sin revelar si el email existe', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(customerRow());
      await expect(service.login({ email: 'client@messi.com', password: 'wrong-pass' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rechaza si el email no tiene cuenta', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(null);
      await expect(service.login({ email: 'ghost@messi.com', password: 'password123' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('marca el email como verificado con un código válido', async () => {
      vi.spyOn(prisma.customerAuthCode, 'findFirst').mockResolvedValue({
        id: 'code-1',
        email: 'client@messi.com',
        type: 'VERIFY_EMAIL',
      } as unknown as CustomerAuthCode);
      const updateManySpy = vi.spyOn(prisma.customer, 'updateMany').mockResolvedValue({ count: 1 });

      const result = await service.verifyEmail('client@messi.com', '123456');

      expect(result.success).toBe(true);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }) }),
      );
    });

    it('rechaza un código inexistente', async () => {
      vi.spyOn(prisma.customerAuthCode, 'findFirst').mockResolvedValue(null);
      await expect(service.verifyEmail('client@messi.com', '000000')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('requestPasswordReset', () => {
    it('no revela si el email existe: responde success igual sin cuenta', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(null);
      const result = await service.requestPasswordReset('ghost@messi.com');
      expect(result.success).toBe(true);
      expect(mail.sendPasswordResetCode).not.toHaveBeenCalled();
    });

    it('envía el código si la cuenta existe', async () => {
      vi.spyOn(prisma.customer, 'findUnique').mockResolvedValue(customerRow());
      vi.spyOn(prisma.customerAuthCode, 'create').mockResolvedValue({} as unknown as CustomerAuthCode);
      await service.requestPasswordReset('client@messi.com');
      expect(mail.sendPasswordResetCode).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('cambia la contraseña con un código de reset válido', async () => {
      vi.spyOn(prisma.customerAuthCode, 'findFirst').mockResolvedValue({
        id: 'code-2',
        email: 'client@messi.com',
        type: 'RESET_PASSWORD',
      } as unknown as CustomerAuthCode);
      const updateManySpy = vi.spyOn(prisma.customer, 'updateMany').mockResolvedValue({ count: 1 });

      await service.resetPassword('client@messi.com', '654321', 'newpassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed:newpassword123' }) }),
      );
    });
  });
});
