import { BadRequestException, type ArgumentMetadata } from '@nestjs/common';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const bodyMetadata: ArgumentMetadata = { type: 'body' };
const paramMetadata: ArgumentMetadata = { type: 'param', data: 'id' };

describe('ZodValidationPipe', () => {
  it('devuelve los datos parseados cuando son válidos', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: 'a@b.com', password: 'password123' }, bodyMetadata);
    expect(result).toEqual({ email: 'a@b.com', password: 'password123' });
  });

  it('descarta propiedades no declaradas en el schema', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform({ email: 'a@b.com', password: 'password123', isAdmin: true }, bodyMetadata);
    expect(result).not.toHaveProperty('isAdmin');
  });

  it('lanza BadRequestException con los errores por campo cuando es inválido', () => {
    const pipe = new ZodValidationPipe(schema);
    let caught: unknown;
    try {
      pipe.transform({ email: 'no-es-un-email', password: '123' }, bodyMetadata);
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as {
      errors: Record<string, string[]>;
    };
    expect(response.errors.email).toBeDefined();
    expect(response.errors.password).toBeDefined();
  });

  it('ignora parámetros que no son el body (ej. :id de la URL), aunque no matcheen el schema', () => {
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform('8572ce23-995a-49e3-845b-81331bfb27c9', paramMetadata);
    expect(result).toBe('8572ce23-995a-49e3-845b-81331bfb27c9');
  });
});
