import { describe, expect, it } from 'vitest';

import { formatCentsAsArs, parseArsToCents } from './money';

describe('formatCentsAsArs', () => {
  it('formatea centavos como pesos sin decimales', () => {
    expect(formatCentsAsArs(199900)).toBe('$1.999');
  });
});

describe('parseArsToCents', () => {
  it('interpreta el punto como separador de miles y la coma como decimal', () => {
    expect(parseArsToCents('1.999,50')).toBe(199950);
  });

  it('interpreta un número simple sin separadores', () => {
    expect(parseArsToCents('1999')).toBe(199900);
  });

  it('rechaza texto no numérico', () => {
    expect(() => parseArsToCents('abc')).toThrow();
  });
});
