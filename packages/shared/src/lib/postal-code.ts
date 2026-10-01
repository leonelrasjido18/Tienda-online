/**
 * Códigos postales argentinos.
 *
 * Conviven dos formatos y la gente escribe los dos indistintamente:
 *   - El viejo, de 4 dígitos: `1425`
 *   - El CPA, vigente desde 1998: `C1425ABC` (letra de provincia + 4 dígitos +
 *     3 letras que identifican la cara de la manzana)
 *
 * Para cotizar un envío sólo importan los 4 dígitos: son los que definen la
 * localidad. Todo lo que entra se reduce a eso, así una tarifa cargada como
 * `1425` también cubre a quien escribe `C1425ABC`, `c1425abc` o `1425 `.
 */

/** Los 4 dígitos, o `null` si no hay un código postal reconocible. */
export function normalizePostalCode(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const limpio = raw.trim().toUpperCase();
  // CPA completo: una letra, 4 dígitos, 3 letras.
  const cpa = /^[A-Z](\d{4})[A-Z]{3}$/.exec(limpio);
  if (cpa) return cpa[1] ?? null;

  // Formato viejo de 4 dígitos, con o sin espacios alrededor.
  if (/^\d{4}$/.test(limpio)) return limpio;

  // Variantes a medio escribir: una letra adelante o los 4 dígitos sueltos
  // dentro de algo más largo. Se toma la primera corrida de 4 dígitos.
  const sueltos = /(?<!\d)(\d{4})(?!\d)/.exec(limpio);
  return sueltos?.[1] ?? null;
}

/**
 * Si dos códigos postales apuntan a la misma localidad.
 * Compara ya normalizado, para que `C1425ABC` y `1425` sean el mismo.
 */
export function samePostalCode(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePostalCode(a);
  const nb = normalizePostalCode(b);
  return na !== null && na === nb;
}
