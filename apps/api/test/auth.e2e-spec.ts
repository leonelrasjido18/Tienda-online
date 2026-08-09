import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers['set-cookie'];
  const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const refreshCookie = cookies.find((c: string) => c.startsWith('refresh_token='));
  if (!refreshCookie) {
    throw new Error('No se recibió la cookie refresh_token');
  }
  return refreshCookie.split(';')[0]!;
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@tienda.local`;
  const password = 'password123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(password, 4);
    await prisma.staffUser.create({
      data: { email, passwordHash, name: 'E2E Test', role: 'STAFF' },
    });
  });

  afterAll(async () => {
    await prisma.staffUser.deleteMany({ where: { email } });
    await app.close();
  });

  it('rechaza credenciales inválidas', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('permite login, refresh rotativo y detecta reuso del token viejo', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginRes.body.accessToken).toBeTypeOf('string');
    expect(loginRes.body.user.email).toBe(email);

    const firstCookie = extractRefreshCookie(loginRes);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(email);

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(200);

    const rotatedCookie = extractRefreshCookie(refreshRes);
    expect(rotatedCookie).not.toBe(firstCookie);
    expect(refreshRes.body.accessToken).not.toBe(loginRes.body.accessToken);

    // Reusar el refresh token ya rotado tiene que fallar y revocar la sesión completa.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', firstCookie)
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(401);
  });

  it('logout revoca el refresh token', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    const cookie = extractRefreshCookie(loginRes);

    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(200);
    await request(app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('rechaza /auth/me sin access token', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });
});
