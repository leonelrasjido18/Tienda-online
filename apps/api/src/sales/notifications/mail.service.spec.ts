import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { expect, vi, describe, it, beforeEach } from 'vitest';

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue({
    sendMail: vi.fn().mockResolvedValue({ messageId: '123' }),
  }),
}));

/** `send` es privado; se expone este tipo sólo para poder espiarlo en los tests. */
type WithSend = { send: (...args: unknown[]) => Promise<unknown> };

describe('MailService', () => {
  let service: MailService;
  let config: Record<string, string | number>;

  beforeEach(async () => {
    config = {
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_FROM: 'no-reply@tienda.local',
      STORE_NOTIFICATION_EMAIL: 'owner@tienda.local',
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => config[key]),
          },
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send order confirmation email', async () => {
    const sendSpy = vi.spyOn(service as unknown as WithSend, 'send');
    await service.sendOrderConfirmation({
      number: 1234,
      contactName: 'Leo Messi',
      contactEmail: 'leo@messi.com',
      totalCents: 15000,
      dueTodayCents: 7500,
      paymentPlan: 'DEPOSIT_BALANCE',
    });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'leo@messi.com',
        subject: expect.stringContaining('2234'),
      }),
    );
  });

  it('should send sale alert email', async () => {
    const sendSpy = vi.spyOn(service as unknown as WithSend, 'send');
    await service.sendSaleAlert({
      number: 1234,
      contactName: 'Leo Messi',
      contactEmail: 'leo@messi.com',
      totalCents: 15000,
      dueTodayCents: 15000,
      paymentPlan: 'FULL',
    }, 'Nuevo pedido');
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@tienda.local',
        subject: expect.stringContaining('2234'),
      }),
    );
  });

  it('should send balance request email', async () => {
    const sendSpy = vi.spyOn(service as unknown as WithSend, 'send');
    await service.sendBalanceRequest({
      contactName: 'Leo Messi',
      contactEmail: 'leo@messi.com',
      displayNumber: '#1234',
      balanceCents: 7500,
      shippingCents: 2500,
      amountCents: 10000,
      url: 'http://localhost/saldo/abc',
      expiresAt: new Date('2026-08-25'),
    });
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'leo@messi.com',
        subject: expect.stringContaining('$100'),
      }),
    );
  });
});
