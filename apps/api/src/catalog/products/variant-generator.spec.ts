import { describe, expect, it } from 'vitest';

import {
  combinationKey,
  generateVariantCombinations,
  optionValueKey,
  planVariantRelink,
  suggestSku,
} from './variant-generator';

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

describe('planVariantRelink', () => {
  // "Talle" con S y M, mas "Manga" con Corta y Larga.
  const TALLE_S = { id: 'v-s', optionId: 'o-talle', clave: optionValueKey('Talle', 'S') };
  const TALLE_M = { id: 'v-m', optionId: 'o-talle', clave: optionValueKey('Talle', 'M') };
  const MANGA_CORTA = { id: 'v-corta', optionId: 'o-manga', clave: optionValueKey('Manga', 'Corta') };
  const MANGA_LARGA = { id: 'v-larga', optionId: 'o-manga', clave: optionValueKey('Manga', 'Larga') };

  it('reenlaza cuando los valores siguen existiendo', () => {
    const plan = planVariantRelink(
      [{ variantId: 'var-1', claves: [optionValueKey('Talle', 'S')] }],
      [TALLE_S, TALLE_M],
    );
    expect(plan.huerfanas).toEqual([]);
    expect(plan.enlaces).toEqual([{ variantId: 'var-1', valueId: 'v-s' }]);
  });

  it('ignora mayusculas y espacios en el nombre de la opcion', () => {
    const plan = planVariantRelink(
      [{ variantId: 'var-1', claves: [optionValueKey('  TALLE ', ' S ')] }],
      [TALLE_S],
    );
    expect(plan.enlaces).toEqual([{ variantId: 'var-1', valueId: 'v-s' }]);
  });

  it('descarta la variante cuando su valor ya no existe', () => {
    const plan = planVariantRelink(
      [{ variantId: 'var-xxl', claves: [optionValueKey('Talle', 'XXL')] }],
      [TALLE_S, TALLE_M],
    );
    expect(plan.enlaces).toEqual([]);
    expect(plan.huerfanas).toEqual(['var-xxl']);
  });

  it('descarta las que cubren solo una parte de las opciones nuevas', () => {
    // Producto que tenia solo talles y al que se le agrega la manga: las viejas
    // no dicen que manga son, asi que no son comprables y hay que regenerarlas.
    const plan = planVariantRelink(
      [{ variantId: 'var-s', claves: [optionValueKey('Talle', 'S')] }],
      [TALLE_S, TALLE_M, MANGA_CORTA, MANGA_LARGA],
    );
    expect(plan.enlaces).toEqual([]);
    expect(plan.huerfanas).toEqual(['var-s']);
  });

  it('conserva las que cubren todas las opciones', () => {
    const plan = planVariantRelink(
      [{ variantId: 'var-s-larga', claves: [optionValueKey('Talle', 'S'), optionValueKey('Manga', 'Larga')] }],
      [TALLE_S, TALLE_M, MANGA_CORTA, MANGA_LARGA],
    );
    expect(plan.huerfanas).toEqual([]);
    expect(plan.enlaces).toHaveLength(2);
    expect(plan.enlaces.map((e) => e.valueId).sort()).toEqual(['v-larga', 'v-s']);
  });

  it('marca todo como huerfano si el producto se queda sin opciones', () => {
    const plan = planVariantRelink([{ variantId: 'var-1', claves: [optionValueKey('Talle', 'S')] }], []);
    expect(plan.huerfanas).toEqual(['var-1']);
  });

  it('al quitar una opcion, las variantes que colapsan no quedan duplicadas', () => {
    // Paso en produccion: se borro la opcion "Manga" y quedaron dos variantes
    // por talle (Corta $42.000 y Larga $46.000) atadas solo al talle. La tienda
    // resolvia a una de las dos y cobraba de mas.
    const previas = [
      { variantId: 'xl-corta', claves: [optionValueKey('Talle', 'XL'), optionValueKey('Manga', 'Corta')] },
      { variantId: 'xl-larga', claves: [optionValueKey('Talle', 'XL'), optionValueKey('Manga', 'Larga')] },
    ];
    // Las opciones nuevas ya no tienen Manga.
    const plan = planVariantRelink(previas, [{ id: 'v-xl', optionId: 'o-talle', clave: optionValueKey('Talle', 'XL') }]);

    expect(plan.enlaces).toEqual([{ variantId: 'xl-corta', valueId: 'v-xl' }]);
    expect(plan.huerfanas).toEqual(['xl-larga']);
  });

  it('no descarta variantes con combinaciones distintas', () => {
    const previas = [
      { variantId: 's', claves: [optionValueKey('Talle', 'S')] },
      { variantId: 'm', claves: [optionValueKey('Talle', 'M')] },
    ];
    const plan = planVariantRelink(previas, [TALLE_S, TALLE_M]);
    expect(plan.huerfanas).toEqual([]);
    expect(plan.enlaces).toHaveLength(2);
  });

  it('reproduce el bug original: variantes vivas sin ningun enlace', () => {
    // Antes del arreglo, guardar opciones dejaba las variantes sin combinacion
    // y el panel las mostraba como "(sin talle)". Ahora se eliminan.
    const previas = ['S', 'M', 'L', 'XL', 'XXL'].map((t) => ({
      variantId: `var-${t}`,
      claves: [optionValueKey('Talle', t)],
    }));
    const plan = planVariantRelink(previas, []);
    expect(plan.enlaces).toEqual([]);
    expect(plan.huerfanas).toHaveLength(5);
  });
});
