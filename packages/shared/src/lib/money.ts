const ARS_FORMATTER = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const WHITESPACE = new RegExp('\\s', 'g');

/** Formatea centavos como pesos argentinos: 199900 -> "$1.999". */
export function formatCentsAsArs(cents: number): string {
  // Intl inserta un espacio (NBSP) entre "$" y el monto segun la locale es-AR;
  // se quita para el formato compacto habitual del e-commerce argentino.
  return ARS_FORMATTER.format(cents / 100).replace(WHITESPACE, '');
}

/** Convierte un input de pesos (admite coma o punto decimal) a centavos enteros. */
export function parseArsToCents(input: string): number {
  const normalized = input.trim().replace(/\./g, '').replace(',', '.');
  const pesos = Number(normalized);
  if (!Number.isFinite(pesos)) {
    throw new Error(`Monto invalido: "${input}"`);
  }
  return Math.round(pesos * 100);
}
