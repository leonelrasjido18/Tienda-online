import { describe, expect, it } from 'vitest';

import { slugify } from './slugify';

describe('slugify', () => {
  it('convierte espacios y mayúsculas en guiones minúsculas', () => {
    expect(slugify('Camiseta River Plate Titular 24/25')).toBe('camiseta-river-plate-titular-24-25');
  });

  it('quita acentos', () => {
    expect(slugify('Selección Argentina')).toBe('seleccion-argentina');
  });

  it('colapsa separadores repetidos y recorta guiones en los extremos', () => {
    expect(slugify('  --Nike  ---Fútbol--  ')).toBe('nike-futbol');
  });
});
