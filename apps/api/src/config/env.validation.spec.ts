import { describe, expect, it } from 'vitest';

import { validateEnv } from './env.validation';

const validConfig = {
  NODE_ENV: 'test',
  PORT: '3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'a-secret-with-enough-length',
  COOKIE_SECRET: 'another-secret-with-length',
  ADMIN_URL: 'http://localhost:3002',
  STOREFRONT_URL: 'http://localhost:3000',
};

describe('validateEnv', () => {
  it('acepta una configuración válida y aplica defaults', () => {
    const result = validateEnv(validConfig);
    expect(result.PORT).toBe(3001);
    expect(result.JWT_ACCESS_TTL).toBe('15m');
    expect(result.REFRESH_TOKEN_TTL_DAYS).toBe(7);
  });

  it('rechaza cuando falta una variable requerida', () => {
    const { DATABASE_URL: _omit, ...rest } = validConfig;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('rechaza secretos demasiado cortos', () => {
    expect(() => validateEnv({ ...validConfig, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('rechaza URLs de admin/storefront inválidas', () => {
    expect(() => validateEnv({ ...validConfig, ADMIN_URL: 'not-a-url' })).toThrow(/ADMIN_URL/);
  });
});
