import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailTemplatesService } from './email-templates.service';
import { expect, vi, describe, it, beforeEach } from 'vitest';

// `vi.hoisted` porque `vi.mock` se eleva por encima de los imports: sin esto no
// hay forma de quedarse con una referencia al transporte para simular un rechazo.
const { transport } = vi.hoisted(() => ({ transport: { sendMail: vi.fn() } }));

vi.mock('nodemailer', () => ({
  createTransport: vi.fn().mockReturnValue(transport),
}));

/** `send` es privado; se expone este tipo sólo para poder espiarlo en los tests. */
type WithSend = { send: (...args: unknown[]) => Promise<unknown> };

const ITEM = {
  id: '11111111-1111-1111-1111-111111111111',
  productName: 'Camiseta Benfica – Titular – 2026-27',
  productSlug: 'camiseta-benfica-titular',
  variantSku: 'BENFICA-S-LARGA',
  optionsLabel: 'Larga / S',
  options: [
    { name: 'Manga', value: 'Larga' },
    { name: 'Talle', value: 'S' },
  ],
  imageUrl: 'https://api.tienda.local/uploads/benfica.jpg',
  unitPriceCents: 4_600_000,
  quantity: 1,
  totalCents: 4_600_000,
  fulfillmentMode: 'PREORDER' as const,
  customization: {
    playerName: 'MESSI',
    playerNumber: 10,
    extraCents: 500_000,
    previewImageUrl: null,
    productionImageUrl: null,
    fontName: 'Champions 2024',
    patchNames: ['Parche Champions'],
  },
};

/** Pedido completo de prueba; cada test pisa sólo lo que le importa. */
function pedido(over: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-2222-2222-222222222222',
    displayNumber: '#2234',
    contactName: 'Leo Messi',
    contactEmail: 'leo@messi.com',
    contactPhone: '341-555-0000',
    paymentPlan: 'DEPOSIT_BALANCE' as const,
    pickupInStore: false,
    shippingStreet: 'Corrientes',
    shippingNumber: '1234',
    shippingFloor: null,
    shippingCity: 'Paraná',
    shippingProvince: 'Entre Ríos',
    shippingPostalCode: '3100',
    shippingNotes: null,
    subtotalCents: 4_600_000,
    shippingCents: null,
    depositCents: 2_300_000,
    balanceCents: 2_300_000,
    totalCents: 4_600_000,
    dueTodayCents: 2_300_000,
    items: [ITEM],
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('MailService', () => {
  let service: MailService;
  let config: Record<string, string | number>;
  let prisma: {
    auditLog: { create: ReturnType<typeof vi.fn> };
    emailTemplate: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(async () => {
    config = {
      SMTP_HOST: 'localhost',
      SMTP_PORT: 1025,
      SMTP_FROM: 'no-reply@tienda.local',
      STORE_NOTIFICATION_EMAIL: 'owner@tienda.local',
      // El constructor la usa para armar los enlaces de los mails. Es
      // obligatoria en `env.validation`, así que acá nunca falta tampoco.
      STOREFRONT_URL: 'http://localhost:3000',
    };

    prisma = {
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      // Sin filas, las plantillas caen en el texto que trae el codigo, que es
      // justo lo que interesa verificar acá.
      emailTemplate: { findMany: vi.fn().mockResolvedValue([]) },
    };
    transport.sendMail.mockReset().mockResolvedValue({ messageId: '123' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => config[key]),
          },
        },
        {
          // `send` anota los fallos en `audit_logs`; acá alcanza con que la
          // llamada exista y no haga nada.
          provide: PrismaService,
          useValue: prisma,
        },
        // El servicio real, para que los tests pasen por el renderizado de
        // plantillas y no por un doble que podria divergir.
        EmailTemplatesService,
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send order confirmation email', async () => {
    const sendSpy = vi.spyOn(service as unknown as WithSend, 'send');
    await service.sendOrderConfirmation(pedido());
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'leo@messi.com',
        subject: expect.stringContaining('#2234'),
      }),
    );
  });

  it('should send sale alert email', async () => {
    const sendSpy = vi.spyOn(service as unknown as WithSend, 'send');
    await service.sendSaleAlert(pedido({ paymentPlan: 'FULL' }), 'Pago aprobado');
    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@tienda.local',
        subject: expect.stringContaining('#2234'),
      }),
    );
  });

  describe('detalle del pedido', () => {
    /** Lee el HTML del último mail enviado. */
    async function htmlDe(fn: () => Promise<void>): Promise<string> {
      const spy = vi.spyOn(service as unknown as WithSend, 'send');
      await fn();
      return (spy.mock.calls.at(-1)?.[0] as { html: string }).html;
    }

    it('incluye enlace al producto, opciones con su nombre y personalización', async () => {
      const html = await htmlDe(() => service.sendOrderConfirmation(pedido()));

      expect(html).toContain('http://localhost:3000/productos/camiseta-benfica-titular');
      // Las opciones van con etiqueta: "S" solo no dice si es talle o manga.
      expect(html).toContain('Talle');
      expect(html).toContain('Manga');
      expect(html).toContain('Larga');
      expect(html).toContain('MESSI');
      expect(html).toContain('10');
      expect(html).toContain('Parche Champions');
      expect(html).toContain('Por encargo');
    });

    it('el mail del dueño lleva el mismo detalle más los datos de contacto', async () => {
      const html = await htmlDe(() => service.sendSaleAlert(pedido(), 'Pago aprobado'));

      expect(html).toContain('leo@messi.com');
      expect(html).toContain('341-555-0000');
      expect(html).toContain('Camiseta Benfica');
      expect(html).toContain('Parche Champions');
    });

    it('muestra la dirección cuando hay envío y el retiro cuando no', async () => {
      const conEnvio = await htmlDe(() => service.sendOrderConfirmation(pedido()));
      expect(conEnvio).toContain('Corrientes');
      expect(conEnvio).toContain('Paraná');

      const conRetiro = await htmlDe(() =>
        service.sendOrderConfirmation(pedido({ pickupInStore: true })),
      );
      expect(conRetiro).toContain('Retiro en el local');
      expect(conRetiro).not.toContain('Corrientes');
    });

    it('cae en el nombre plano si el producto ya no existe', async () => {
      const item = { ...ITEM, productSlug: null, options: [] };
      const html = await htmlDe(() => service.sendOrderConfirmation(pedido({ items: [item] })));

      expect(html).toContain('Camiseta Benfica');
      expect(html).not.toContain('/productos/');
      // Sin opciones estructuradas se usa `optionsLabel`, que es lo que hay en
      // los pedidos viejos.
      expect(html).toContain('Larga / S');
    });
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

  describe('cuando el SMTP rechaza', () => {
    it('no propaga el error, pero lo deja anotado en audit_logs', async () => {
      transport.sendMail.mockRejectedValueOnce(new Error('535 authentication failed'));

      // Que no tire: un mail caído no debe tumbar el registro ni un pedido cobrado.
      await expect(service.sendEmailVerificationCode('leo@messi.com', '123456')).resolves.toBeUndefined();

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'MAIL_SEND_FAILED',
            entityType: 'Mail',
            metadata: expect.objectContaining({ to: 'leo@messi.com' }),
          }),
        }),
      );
    });

    it('lo refleja en el health check y vuelve a ok tras un envío exitoso', async () => {
      expect(service.getMailHealth().status).toBe('ok');

      transport.sendMail.mockRejectedValueOnce(new Error('535 authentication failed'));
      await service.sendEmailVerificationCode('leo@messi.com', '123456');

      const failing = service.getMailHealth();
      expect(failing.status).toBe('failing');
      expect(failing.consecutiveFailures).toBe(1);
      expect(failing.lastFailureReason).toContain('535');

      await service.sendEmailVerificationCode('leo@messi.com', '123456');
      expect(service.getMailHealth()).toMatchObject({ status: 'ok', consecutiveFailures: 0 });
    });

    it('sigue adelante aunque tampoco se pueda escribir el registro', async () => {
      transport.sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));
      prisma.auditLog.create.mockRejectedValueOnce(new Error('la base tampoco responde'));

      await expect(service.sendEmailVerificationCode('leo@messi.com', '123456')).resolves.toBeUndefined();
      expect(service.getMailHealth().status).toBe('failing');
    });
  });
});
