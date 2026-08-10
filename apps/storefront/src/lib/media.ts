const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** Los uploads se guardan como rutas relativas ("/uploads/…") servidas por la API, no por Next.js. */
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  return url.startsWith('http') ? url : `${API_URL}${url}`;
}
