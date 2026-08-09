const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Convierte texto libre en un slug de URL: minúsculas, sin acentos, separado por guiones. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
