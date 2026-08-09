import { describe, expect, it } from 'vitest';

import { buildCustomizationInputSchema, containsBlockedWord } from './customization-input.schema';

describe('containsBlockedWord', () => {
  it('detecta palabras bloqueadas sin importar mayúsculas', () => {
    expect(containsBlockedWord('SOS UN BOLUDO')).toBe(true);
  });

  it('no marca nombres normales', () => {
    expect(containsBlockedWord('MESSI')).toBe(false);
  });
});

describe('buildCustomizationInputSchema', () => {
  const schema = buildCustomizationInputSchema({ maxNameLength: 10, minNumber: 1, maxNumber: 99 });

  it('acepta un nombre y dorsal válidos', () => {
    const result = schema.safeParse({ playerName: 'MESSI', playerNumber: 10 });
    expect(result.success).toBe(true);
  });

  it('rechaza un nombre más largo que el límite del producto', () => {
    const result = schema.safeParse({ playerName: 'NOMBRE DEMASIADO LARGO' });
    expect(result.success).toBe(false);
  });

  it('rechaza un dorsal fuera de rango', () => {
    const result = schema.safeParse({ playerNumber: 150 });
    expect(result.success).toBe(false);
  });

  it('rechaza símbolos no permitidos', () => {
    const result = schema.safeParse({ playerName: 'MESSI<script>' });
    expect(result.success).toBe(false);
  });

  it('rechaza palabras de la lista bloqueada', () => {
    const result = schema.safeParse({ playerName: 'PELOTUDO' });
    expect(result.success).toBe(false);
  });
});
