import { describe, expect, it } from 'vitest';

import { combinationKey, generateVariantCombinations, suggestSku } from './variant-generator';

describe('generateVariantCombinations', () => {
  it('devuelve vacío cuando no hay opciones', () => {
    expect(generateVariantCombinations([])).toEqual([]);
  });

  it('devuelve una combinación por valor cuando hay una sola opción', () => {
    const result = generateVariantCombinations([
      { id: 'opt-talle', values: [{ id: 'v-s', value: 'S' }, { id: 'v-m', value: 'M' }] },
    ]);
    expect(result).toEqual([
      { optionValueIds: ['v-s'], labels: ['S'] },
      { optionValueIds: ['v-m'], labels: ['M'] },
    ]);
  });

  it('calcula el producto cartesiano entre dos opciones', () => {
    const result = generateVariantCombinations([
      { id: 'opt-talle', values: [{ id: 'v-s', value: 'S' }, { id: 'v-m', value: 'M' }] },
      { id: 'opt-version', values: [{ id: 'v-fan', value: 'Fan' }, { id: 'v-player', value: 'Player' }] },
    ]);

    expect(result).toHaveLength(4);
    expect(result.map((c) => c.labels)).toEqual([
      ['S', 'Fan'],
      ['S', 'Player'],
      ['M', 'Fan'],
      ['M', 'Player'],
    ]);
  });

  it('escala a tres opciones (talle x versión x manga)', () => {
    const result = generateVariantCombinations([
      { id: 'a', values: [{ id: 'a1', value: 'S' }, { id: 'a2', value: 'M' }] },
      { id: 'b', values: [{ id: 'b1', value: 'Fan' }] },
      { id: 'c', values: [{ id: 'c1', value: 'Corta' }, { id: 'c2', value: 'Larga' }] },
    ]);
    expect(result).toHaveLength(4);
  });
});

describe('combinationKey', () => {
  it('es estable sin importar el orden de los ids', () => {
    expect(combinationKey(['b', 'a'])).toBe(combinationKey(['a', 'b']));
  });

  it('distingue combinaciones distintas', () => {
    expect(combinationKey(['a', 'b'])).not.toBe(combinationKey(['a', 'c']));
  });
});

describe('suggestSku', () => {
  it('arma el SKU a partir del slug y las etiquetas', () => {
    expect(suggestSku('camiseta-river-plate', ['M', 'Fan'])).toBe('CAMISETARIVERPLATE-M-FAN');
  });

  it('quita acentos y símbolos de las etiquetas', () => {
    expect(suggestSku('camiseta', ['Edición Especial'])).toBe('CAMISETA-EDICIONESPECIAL');
  });

  it('funciona sin etiquetas', () => {
    expect(suggestSku('producto-simple', [])).toBe('PRODUCTOSIMPLE');
  });
});
