const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiNotFoundError extends Error {}

/** Fetch a la API pública del catálogo. Sirve tanto en Server Components como en el cliente. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    next: { revalidate: 60 },
  });

  if (res.status === 404) {
    throw new ApiNotFoundError(`No encontrado: ${path}`);
  }
  if (!res.ok) {
    throw new Error(`Error de API (${res.status}) en ${path}`);
  }

  return (await res.json()) as T;
}
