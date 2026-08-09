import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { AppModule } from '../src/app.module';

// El JwtAuthGuard es global: cualquier ruta nueva que deba ser pública tiene que
// marcarse con @Public() explícitamente. Este test evita que rutas que deberían
// ser públicas (monitoreo, catálogo de la tienda) queden bloqueadas por accidente.
describe('Rutas públicas (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health no requiere autenticación', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).not.toBe(401);
  });

  it('GET /catalog/products no requiere autenticación', async () => {
    const res = await request(app.getHttpServer()).get('/catalog/products');
    expect(res.status).not.toBe(401);
  });

  it('GET /admin/products sí requiere autenticación', async () => {
    const res = await request(app.getHttpServer()).get('/admin/products');
    expect(res.status).toBe(401);
  });
});
