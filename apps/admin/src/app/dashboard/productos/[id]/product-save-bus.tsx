'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';

/**
 * Registro compartido para el botón "Guardar y volver" de la cabecera.
 *
 * Cada sección de la ficha guarda contra un endpoint distinto y tiene su propio
 * estado local. En vez de subir todo ese estado a la página, cada una se
 * registra acá con su función de guardado y una forma de decir si tiene cambios
 * pendientes; la cabecera las llama en orden.
 */

/** Orden de guardado. Las opciones van antes que la grilla porque pueden regenerar variantes. */
export const SAVE_ORDER = ['general', 'options', 'variants', 'customization'] as const;
export type SaveSection = (typeof SAVE_ORDER)[number];

interface Registro {
  save: () => Promise<void>;
  isDirty: () => boolean;
}

interface Bus {
  register: (section: SaveSection, registro: Registro) => () => void;
  saveAll: () => Promise<{ guardadas: SaveSection[]; variantesOmitidas: boolean }>;
}

const SaveBusContext = createContext<Bus | null>(null);

export function ProductSaveBusProvider({ children }: { children: React.ReactNode }) {
  const registros = useRef(new Map<SaveSection, Registro>());

  const register = useCallback((section: SaveSection, registro: Registro) => {
    registros.current.set(section, registro);
    return () => {
      // Sólo se borra si sigue siendo el mismo registro: en un re-montaje rápido
      // el nuevo puede haberse registrado antes de que corra esta limpieza.
      if (registros.current.get(section) === registro) {
        registros.current.delete(section);
      }
    };
  }, []);

  const saveAll = useCallback(async () => {
    const guardadas: SaveSection[] = [];
    let variantesOmitidas = false;
    let opcionesGuardadas = false;

    for (const section of SAVE_ORDER) {
      const registro = registros.current.get(section);
      if (!registro || !registro.isDirty()) continue;

      // Guardar opciones regenera las variantes, así que los ids que tiene
      // cargados la grilla quedan viejos: mandarlos fallaría o pisaría otra
      // fila. Se omite y se avisa.
      if (section === 'variants' && opcionesGuardadas) {
        variantesOmitidas = true;
        continue;
      }

      await registro.save();
      guardadas.push(section);
      if (section === 'options') opcionesGuardadas = true;
    }

    return { guardadas, variantesOmitidas };
  }, []);

  const value = useMemo(() => ({ register, saveAll }), [register, saveAll]);
  return <SaveBusContext.Provider value={value}>{children}</SaveBusContext.Provider>;
}

export function useProductSaveBus(): Bus {
  const bus = useContext(SaveBusContext);
  if (!bus) {
    throw new Error('useProductSaveBus necesita estar dentro de <ProductSaveBusProvider>');
  }
  return bus;
}

/**
 * Registra el guardado de una sección. `save` e `isDirty` se leen por
 * referencia en cada llamada, así que no hace falta que sean estables.
 */
export function useRegisterSave(section: SaveSection, save: () => Promise<void>, isDirty: () => boolean) {
  const bus = useContext(SaveBusContext);
  const ref = useRef({ save, isDirty });

  // El ref se refresca en un efecto y no durante el render (escribir refs
  // mientras se renderiza rompe con React Compiler). Alcanza: `saveAll` corre
  // desde un click, mucho después de que los efectos se hayan aplicado.
  useEffect(() => {
    ref.current = { save, isDirty };
  });

  useEffect(() => {
    if (!bus) return;
    return bus.register(section, {
      save: () => ref.current.save(),
      isDirty: () => ref.current.isDirty(),
    });
  }, [bus, section]);
}
