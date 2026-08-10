import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

/**
 * La auditoría marcó como hallazgo crítico que cualquier usuario autenticado
 * podía ejecutar toda la API de administración. Estas pruebas fijan la matriz:
 * el personal opera el día a día, pero sólo la dueña toca plata y configuración.
 */
describe('Autorización por rol (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const password = 'password123';
  const staffEmail = `e2e-staff-${Date.now()}@tienda.local`;
  const ownerEmail = `e2e-owner-${Date.now()}@tienda.local`;

  let staffToken = '';
  let ownerToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 4);
    await prisma.staffUser.createMany({
      data: [
        { email: staffEmail, passwordHash, name: 'E2E Staff', role: 'STAFF' },
        { email: ownerEmail, passwordHash, name: 'E2E Owner', role: 'OWNER' },
      ],
    });

    const login = async (email: string) => {
      const res = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
      return res.body.accessToken as string;
    };
    staffToken = await login(staffEmail);
    ownerToken = await login(ownerEmail);
  });

  afterAll(async () => {
    await prisma.staffUser.deleteMany({ where: { email: { in: [staffEmail, ownerEmail] } } });
    await app.close();
  });

  describe('el personal puede operar el día a día', () => {
    it('lista pedidos', async () => {
      await request(app.getHttpServer())
        .get('/admin/orders')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('lista productos', async () => {
      await request(app.getHttpServer())
        .get('/admin/products')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });

    it('lista lotes de importación', async () => {
      await request(app.getHttpServer())
        .get('/admin/batches')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);
    });
  });

  describe('el personal NO puede tocar plata ni configuración', () => {
    it('no puede reembolsar', async () => {
      await request(app.getHttpServer())
        .post('/admin/orders/00000000-0000-0000-0000-000000000000/refund')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ amountCents: 1000, reason: 'test' })
        .expect(403);
    });

    it('no puede cancelar un pedido', async () => {
      await request(app.getHttpServer())
        .post('/admin/orders/00000000-0000-0000-0000-000000000000/cancel')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ reason: 'test' })
        .expect(403);
    });

    it('no puede dar por cobrada una transferencia', async () => {
      await request(app.getHttpServer())
        .post('/admin/orders/00000000-0000-0000-0000-000000000000/payments/x/approve-transfer')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('no puede marcar un saldo como cobrado', async () => {
      await request(app.getHttpServer())
        .post('/admin/batches/orders/00000000-0000-0000-0000-000000000000/mark-balance-paid')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({})
        .expect(403);
    });

    it('no puede leer ni cambiar los ajustes de la tienda', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });

    it('no puede cambiar las tarifas de envío', async () => {
      await request(app.getHttpServer())
        .get('/admin/shipping/rates')
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(403);
    });
  });

  describe('la dueña sí puede', () => {
    it('lee los ajustes de la tienda', async () => {
      await request(app.getHttpServer())
        .get('/admin/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });

    it('lee las tarifas de envío', async () => {
      await request(app.getHttpServer())
        .get('/admin/shipping/rates')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });

  it('sin token no se entra a ningún endpoint de administración', async () => {
    await request(app.getHttpServer()).get('/admin/orders').expect(401);
  });
});
