import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrdersService } from '../src/sales/orders/orders.service';
import { ReservationExpiryProcessor } from '../src/sales/orders/reservation-expiry.processor';
import { MailService } from '../src/sales/notifications/mail.service';
import { PushService } from '../src/sales/notifications/push.service';
import { MetaConversionsService } from '../src/sales/analytics/meta-conversions.service';

/**
 * Hallazgo de la auditoría: las máquinas de estado y los locks (FOR UPDATE) están,
 * pero no había pruebas que blindaran los casos límite de dinero e inventario. Estas
 * corren contra la base real (los mocks de Prisma no ejercitan locks reales):
 *
 *  1. Dos webhooks simultáneos del mismo pago → un solo consumo de stock.
 *  2. Aprobación y expiración concurrentes → un único estado coherente.
 *  3. Webhook con monto/moneda/proveedor distintos → rechazado sin tocar nada.
 */
describe('Concurrencia de pagos e inventario (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let expiry: ReservationExpiryProcessor;

  const created = { orders: [] as string[], variants: [] as string[], products: [] as string[] };

  const INITIAL_STOCK = 5;
  const ORDER_QTY = 1;
  const AMOUNT = 10_000;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // El envío de mail/push/analítica ocurre tras confirmar el pago; se mockea para
      // que las pruebas no dependan de SMTP ni de servicios externos.
      .overrideProvider(MailService)
      .useValue({ sendSaleAlert: vi.fn() })
      .overrideProvider(PushService)
      .useValue({ broadcast: vi.fn() })
      .overrideProvider(MetaConversionsService)
      .useValue({ trackPurchase: vi.fn() })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
    expiry = app.get(ReservationExpiryProcessor);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prisma.stockMovement.deleteMany({ where: { variantId: { in: created.variants } } });
    await prisma.orderEvent.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: created.orders } } });
    await prisma.order.deleteMany({ where: { id: { in: created.orders } } });
    await prisma.inventoryItem.deleteMany({ where: { variantId: { in: created.variants } } });
    await prisma.productVariant.deleteMany({ where: { id: { in: created.variants } } });
    await prisma.product.deleteMany({ where: { id: { in: created.products } } });
    created.orders = [];
    created.variants = [];
    created.products = [];
  });

  /** Crea un pedido IN_STOCK PENDING con stock ya reservado y un pago PENDING. */
  async function seedOrder() {
    const uid = randomUUID().slice(0, 8);
    const product = await prisma.product.create({
      data: { slug: `conc-${uid}`, name: `Conc ${uid}`, status: 'ACTIVE' },
    });
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, sku: `SKU-${uid}`, priceCents: AMOUNT },
    });
    await prisma.inventoryItem.create({
      // reserved = ORDER_QTY simula la reserva hecha al crear el pedido.
      data: { variantId: variant.id, quantity: INITIAL_STOCK, reserved: ORDER_QTY, trackInventory: true },
    });
    const order = await prisma.order.create({
      data: {
        publicToken: randomUUID(),
        contactName: 'Test Concurrencia',
        contactEmail: `conc-${uid}@test.local`,
        subtotalCents: AMOUNT,
        totalCents: AMOUNT,
        paymentPlan: 'FULL',
        financialStatus: 'PENDING',
        fulfillmentStatus: 'UNFULFILLED',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        variantId: variant.id,
        productName: product.name,
        variantSku: variant.sku,
        unitPriceCents: AMOUNT,
        quantity: ORDER_QTY,
        totalCents: AMOUNT * ORDER_QTY,
        fulfillmentMode: 'IN_STOCK',
      },
    });
    const payment = await prisma.payment.create({
      data: { orderId: order.id, kind: 'FULL', provider: 'mercadopago', amountCents: AMOUNT, status: 'PENDING' },
    });

    created.products.push(product.id);
    created.variants.push(variant.id);
    created.orders.push(order.id);
    return { orderId: order.id, paymentId: payment.id, variantId: variant.id };
  }

  function approve(paymentId: string, over: Partial<{ amountCents: number; currency: string; provider: string }> = {}) {
    return orders.applyPaymentStatus(paymentId, {
      provider: 'mercadopago',
      status: 'APPROVED',
      providerPaymentId: `pp-${randomUUID().slice(0, 6)}`,
      amountCents: AMOUNT,
      currency: 'ARS',
      rawPayload: {},
      ...over,
    });
  }

  it('dos webhooks simultáneos del mismo pago descuentan el stock una sola vez', async () => {
    const { orderId, paymentId, variantId } = await seedOrder();

    await Promise.allSettled([approve(paymentId), approve(paymentId)]);

    const inv = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
    expect(inv.quantity).toBe(INITIAL_STOCK - ORDER_QTY);
    expect(inv.reserved).toBe(0);

    const sales = await prisma.stockMovement.count({ where: { variantId, type: 'SALE' } });
    expect(sales).toBe(1);

    const approvedEvents = await prisma.orderEvent.count({ where: { orderId, type: 'payment_approved' } });
    expect(approvedEvents).toBe(1);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('APPROVED');
  });

  it('rechaza el webhook con monto, moneda o proveedor distintos sin tocar la orden', async () => {
    const { paymentId, variantId } = await seedOrder();

    await expect(approve(paymentId, { amountCents: AMOUNT - 1 })).rejects.toThrow();
    await expect(approve(paymentId, { currency: 'USD' })).rejects.toThrow();
    await expect(approve(paymentId, { provider: 'uala' })).rejects.toThrow();

    const inv = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
    expect(inv.quantity).toBe(INITIAL_STOCK);
    expect(inv.reserved).toBe(ORDER_QTY);

    const sales = await prisma.stockMovement.count({ where: { variantId, type: 'SALE' } });
    expect(sales).toBe(0);

    const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(payment.status).toBe('PENDING');
  });

  it('aprobación y expiración concurrentes dejan un único estado coherente', async () => {
    const { orderId, paymentId, variantId } = await seedOrder();

    await Promise.allSettled([
      approve(paymentId),
      expiry.process({ data: { orderId } } as Parameters<typeof expiry.process>[0]),
    ]);

    const inv = await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } });
    const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const sales = await prisma.stockMovement.count({ where: { variantId, type: 'SALE' } });

    // Gane quien gane el lock de la orden, la reserva se libera exactamente una vez
    // y el stock nunca queda negativo ni consumido dos veces.
    expect(inv.reserved).toBe(0);

    if (order.financialStatus === 'PAID') {
      expect(inv.quantity).toBe(INITIAL_STOCK - ORDER_QTY);
      expect(sales).toBe(1);
    } else {
      expect(order.financialStatus).toBe('EXPIRED');
      expect(inv.quantity).toBe(INITIAL_STOCK);
      expect(sales).toBe(0);
    }
  });
});
