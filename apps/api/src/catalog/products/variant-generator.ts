const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');
const NON_ALPHANUMERIC = /[^A-Z0-9]+/g;

export interface OptionForGeneration {
  id: string;
  values: { id: string; value: string }[];
}

export interface VariantCombination {
  optionValueIds: string[];
  labels: string[];
}

/** Combinación de talle x versión x ... -> todas las variantes posibles (producto cartesiano). */
export function generateVariantCombinations(options: OptionForGeneration[]): VariantCombination[] {
  if (options.length === 0) {
    return [];
  }

  let combinations: VariantCombination[] = [{ optionValueIds: [], labels: [] }];

  for (const option of options) {
    const next: VariantCombination[] = [];
    for (const combo of combinations) {
      for (const value of option.values) {
        next.push({
          optionValueIds: [...combo.optionValueIds, value.id],
          labels: [...combo.labels, value.value],
        });
      }
    }
    combinations = next;
  }

  return combinations;
}

/** Clave canónica de una combinación de valores, sin importar el orden. Sirve para detectar variantes ya creadas. */
export function combinationKey(optionValueIds: string[]): string {
  return [...optionValueIds].sort().join('|');
}

/** Cómo queda identificada una opción elegida, independiente de los ids. */
export function optionValueKey(optionName: string, value: string): string {
  return `${optionName.trim().toLowerCase()}=${value.trim()}`;
}

export interface VariantePrevia {
  variantId: string;
  /** Claves de `optionValueKey` que tenía antes de tocar las opciones. */
  claves: string[];
}

export interface ValorNuevo {
  id: string;
  optionId: string;
  clave: string;
}

export interface PlanDeReenlace {
  enlaces: { variantId: string; valueId: string }[];
  huerfanas: string[];
}

/**
 * Decide qué variantes sobreviven a un cambio de opciones y con qué valores se
 * vuelven a enlazar.
 *
 * Reemplazar las opciones borra sus valores y, por cascada, los enlaces de las
 * variantes. Sin este reenlace las variantes quedan vivas pero sin combinación:
 * la grilla las muestra como "(sin talle)" y el producto no se puede comprar.
 *
 * Una variante sólo se conserva si cubre TODAS las opciones nuevas con un valor
 * cada una. A medio emparejar no representa nada comprable.
 */
export function planVariantRelink(previas: VariantePrevia[], valoresNuevos: ValorNuevo[]): PlanDeReenlace {
  const porClave = new Map(valoresNuevos.map((v) => [v.clave, v]));
  const cantidadOpciones = new Set(valoresNuevos.map((v) => v.optionId)).size;

  const enlaces: { variantId: string; valueId: string }[] = [];
  const huerfanas: string[] = [];
  // Combinaciones ya tomadas. Al QUITAR una opción, varias variantes colapsan en
  // la misma combinación: quedaban dos "XL" con precios distintos y la tienda
  // resolvía a una al azar, cobrando de más. Sobrevive la primera por posición.
  const combinacionesVistas = new Set<string>();

  for (const previa of previas) {
    const encontrados = previa.claves.map((c) => porClave.get(c)).filter((v): v is ValorNuevo => !!v);
    const opcionesCubiertas = new Set(encontrados.map((v) => v.optionId));
    if (cantidadOpciones === 0 || opcionesCubiertas.size !== cantidadOpciones) {
      huerfanas.push(previa.variantId);
      continue;
    }

    const combinacion = encontrados
      .map((v) => v.id)
      .sort()
      .join('|');
    if (combinacionesVistas.has(combinacion)) {
      huerfanas.push(previa.variantId);
      continue;
    }
    combinacionesVistas.add(combinacion);

    for (const valor of encontrados) {
      enlaces.push({ variantId: previa.variantId, valueId: valor.id });
    }
  }

  return { enlaces, huerfanas };
}

/** SKU sugerido a partir del slug del producto y las etiquetas de la combinación (ej: "CAMISETA-RIVER-M-FAN"). */
export function suggestSku(productSlug: string, labels: string[]): string {
  const base = productSlug.toUpperCase().replace(/-/g, '');
  const suffix = labels
    .map((label) =>
      label.normalize('NFD').replace(COMBINING_DIACRITICS, '').toUpperCase().replace(NON_ALPHANUMERIC, ''),
    )
    .join('-');
  return suffix ? `${base}-${suffix}` : base;
}
