'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * Favoritos del visitante.
 *
 * Se guardan en el navegador y no en la cuenta: la mayoría llega sin
 * registrarse, y pedir una cuenta para marcar un favorito es justo la fricción
 * que esto quiere evitar. La contra es que no se comparten entre dispositivos.
 *
 * Vive fuera de React y se lee con `useSyncExternalStore` porque el servidor no
 * tiene localStorage: así el primer render coincide con el del servidor (lista
 * vacía) y React la reemplaza sola al hidratar, sin efectos que disparen
 * renders en cascada.
 */
const CLAVE = 'remerasdelarea:favoritos';

export interface Favorito {
  slug: string;
  name: string;
  imageUrl: string | null;
  priceCents: number | null;
}

const VACIO: Favorito[] = [];

/** Se cachea el parseo: `getSnapshot` tiene que devolver la misma referencia. */
let cacheCrudo: string | null = null;
let cacheParseado: Favorito[] = VACIO;
const oyentes = new Set<() => void>();

function leer(): Favorito[] {
  let crudo: string | null;
  try {
    crudo = localStorage.getItem(CLAVE);
  } catch {
    // Modo privado o almacenamiento bloqueado.
    return VACIO;
  }
  if (crudo === cacheCrudo) return cacheParseado;

  cacheCrudo = crudo;
  try {
    const datos = crudo ? JSON.parse(crudo) : [];
    cacheParseado = Array.isArray(datos) ? datos.filter((f) => f && typeof f.slug === 'string') : VACIO;
  } catch {
    cacheParseado = VACIO;
  }
  return cacheParseado;
}

function escribir(siguiente: Favorito[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(siguiente));
  } catch {
    // Se pierde al recargar, pero la sesión actual sigue andando.
  }
  cacheCrudo = null; // fuerza el reparseo en el próximo snapshot
  for (const avisar of oyentes) avisar();
}

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  // Otra pestaña del mismo navegador puede tocar la lista.
  const alCambiarStorage = (e: StorageEvent) => {
    if (e.key === CLAVE) {
      cacheCrudo = null;
      avisar();
    }
  };
  window.addEventListener('storage', alCambiarStorage);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', alCambiarStorage);
  };
}

/** En el servidor no hay favoritos: siempre la misma referencia vacía. */
const snapshotServidor = () => VACIO;

/**
 * Si ya se hidrató. En el render de hidratación `useSyncExternalStore` devuelve
 * el snapshot del servidor (lista vacía), así que sin esto la pantalla mostraría
 * "no guardaste ninguna" por un instante aunque hubiera favoritos.
 */
const sinOyentes = () => () => undefined;
function useHidratado() {
  return useSyncExternalStore(sinOyentes, () => true, () => false);
}

export function FavoritosProvider({ children }: { children: React.ReactNode }) {
  // Ya no hace falta un contexto: el estado vive en el módulo. Se conserva el
  // componente para no tener que tocar el layout si mañana vuelve a necesitarlo.
  return <>{children}</>;
}

export function useFavoritos() {
  const favoritos = useSyncExternalStore(suscribir, leer, snapshotServidor);
  const hidratado = useHidratado();

  const alternar = useCallback((favorito: Favorito) => {
    const actuales = leer();
    const existe = actuales.some((f) => f.slug === favorito.slug);
    escribir(existe ? actuales.filter((f) => f.slug !== favorito.slug) : [favorito, ...actuales]);
  }, []);

  const quitar = useCallback((slug: string) => {
    escribir(leer().filter((f) => f.slug !== slug));
  }, []);

  return useMemo(
    () => ({
      favoritos,
      esFavorito: (slug: string) => favoritos.some((f) => f.slug === slug),
      alternar,
      quitar,
      listo: hidratado,
    }),
    [favoritos, alternar, quitar, hidratado],
  );
}
