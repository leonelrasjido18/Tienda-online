const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiNotFoundError extends Error {}

/**
 * Fetch a la API pública del catálogo. Sirve tanto en Server Components como en el cliente.
 *
 * Sin caché a propósito. Antes llevaba `revalidate: 60`, que es "sirvo la copia
 * guardada y la renuevo en segundo plano": si nadie había entrado a esa página en
 * un rato, el primer visitante veía el catálogo viejo. Con un catálogo que se
 * edita todo el día en el panel, eso se traducía en camisetas ya borradas que
 * seguían apareciendo y nombres que no cambiaban, y la única forma de verlo
 * actualizado era visitar la página dos veces.
 *
 * La API y la tienda corren en el mismo servidor y el listado responde en
 * ~250 ms, así que pedirlo siempre cuesta menos que servir datos desactualizados.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });

  if (res.status === 404) {
    throw new ApiNotFoundError(`No encontrado: ${path}`);
  }
  if (!res.ok) {
    throw new Error(`Error de API (${res.status}) en ${path}`);
  }

  return (await res.json()) as T;
}
