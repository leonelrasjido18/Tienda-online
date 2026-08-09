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
