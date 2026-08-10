import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StockReservationService } from '../stock/stock-reservation.service';
import { MailService } from '../notifications/mail.service';
import { PushService } from '../notifications/push.service';
import { PaymentProviderRegistry } from '../payments/payment-provider.registry';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { expect, vi, describe, it, beforeEach } from 'vitest';

type MockFn = ReturnType<typeof vi.fn>;

/**
 * `$transaction` es una función suelta y el resto son grupos de métodos, así que
 * el mock no se puede tipar como un diccionario uniforme: hay que declarar la forma.
 */
interface PrismaMock {
  order: { findUnique: MockFn; findUniqueOrThrow: MockFn; update: MockFn };
  payment: { findMany: MockFn; create: MockFn };
  paymentLink: { updateMany: MockFn };
  orderEvent: { create: MockFn };
  $transaction: MockFn;
}

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaMock;
  let stock: Record<string, MockFn>;
  let mail: Record<string, MockFn>;
  let push: Record<string, MockFn>;
  let registry: Record<string, MockFn>;

  beforeEach(async () => {
    prisma = {
      order: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        update: vi.fn(),
      },
      payment: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
      paymentLink: {
        updateMany: vi.fn(),
      },
      orderEvent: {
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
    };

    stock = {
      release: vi.fn(),
      returnStock: vi.fn(),
    };

    mail = {
      sendShipmentNotification: vi.fn(),
    };

    push = {};

    registry = {
      byName: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: StockReservationService, useValue: stock },
        { provide: MailService, useValue: mail },
        { provide: PushService, useValue: push },
        { provide: PaymentProviderRegistry, useValue: registry },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  describe('cancel', () => {
    it('debería lanzar NotFoundException si el pedido no existe', async () => {
      prisma.order.findUnique.mockResolvedValue(null);
      await expect(service.cancel('123')).rejects.toThrow(NotFoundException);
    });

    it('debería lanzar BadRequestException si el pedido ya está cancelado', async () => {
      prisma.order.findUnique.mockResolvedValue({ id: '123', fulfillmentStatus: 'CANCELLED' });
      await expect(service.cancel('123')).rejects.toThrow(BadRequestException);
    });

    it('debería liberar reserva si el pago está PENDING', async () => {
      const order = {
        id: '123',
        number: 1,
        contactName: 'Messi',
        contactEmail: 'leo@messi.com',
        paymentPlan: 'FULL',
        totalCents: 10000,
        createdAt: new Date(),
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PENDING',
        items: [{ variantId: 'v1', quantity: 2, fulfillmentMode: 'IN_STOCK' }],
        events: [],
        payments: [],
        shipment: null,
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.findUniqueOrThrow.mockResolvedValue(order);
      prisma.paymentLink.updateMany.mockResolvedValue({ count: 1 });

      await service.cancel('123', 'Cliente arrepentido');

      expect(stock.release).toHaveBeenCalledWith(expect.anything(), [{ variantId: 'v1', quantity: 2 }]);
      expect(stock.returnStock).not.toHaveBeenCalled();
    });

    it('debería devolver stock si el pago está PAID', async () => {
      const order = {
        id: '123',
        number: 2,
        contactName: 'Messi',
        contactEmail: 'leo@messi.com',
        paymentPlan: 'FULL',
        totalCents: 10000,
        createdAt: new Date(),
        fulfillmentStatus: 'UNFULFILLED',
        financialStatus: 'PAID',
        items: [{ variantId: 'v1', quantity: 2, fulfillmentMode: 'IN_STOCK' }],
        events: [],
        payments: [],
        shipment: null,
      };
      prisma.order.findUnique.mockResolvedValue(order);
      prisma.order.findUniqueOrThrow.mockResolvedValue(order);

      await service.cancel('123', 'Cancelado por administrador');

      expect(stock.returnStock).toHaveBeenCalledWith(expect.anything(), [{ variantId: 'v1', quantity: 2 }]);
      expect(stock.release).not.toHaveBeenCalled();
    });
  });
});
