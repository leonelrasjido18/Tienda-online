import { describe, expect, it } from 'vitest';

import { loginSchema } from './auth.schema';

describe('loginSchema', () => {
  it('acepta un email y password válidos', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('rechaza un email inválido', () => {
    const result = loginSchema.safeParse({ email: 'no-es-email', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rechaza passwords de menos de 8 caracteres', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '1234567' });
    expect(result.success).toBe(false);
  });
});
