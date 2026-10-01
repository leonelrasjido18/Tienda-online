'use client';

import { formatCentsAsArs, type OrderSummaryDto } from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';
import { Bell, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useApi } from '@/lib/use-api';

/** Cada cuánto se pregunta por pedidos nuevos. */
const INTERVALO_MS = 20_000;
/** Cuánto queda el aviso en pantalla. */
const DURACION_MS = 10_000;

interface Aviso {
  id: string;
  numero: string;
  cliente: string;
  total: string;
  href: string;
}

/**
 * Avisa de pedidos nuevos sin salir del panel.
 *
 * Hay dos vías y se complementan: el service worker avisa al instante cuando el
 * push está activo, y el sondeo cubre el resto (permiso denegado, navegador sin
 * soporte, o el push que nunca llega). Los ids ya avisados se recuerdan, así que
 * que lleguen las dos no duplica el cartel.
 */
export function NuevosPedidosToaster() {
  const api = useApi();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  // Pedidos ya anunciados. Se llena en la primera consulta sin mostrar nada:
  // al abrir el panel no tiene sentido avisar de lo que ya estaba.
  const conocidos = useRef<Set<string> | null>(null);

  const cerrar = useCallback((id: string) => {
    setAvisos((previos) => previos.filter((a) => a.id !== id));
  }, []);

  const mostrar = useCallback(
    (aviso: Aviso) => {
      setAvisos((previos) => (previos.some((a) => a.id === aviso.id) ? previos : [aviso, ...previos].slice(0, 4)));
      setTimeout(() => cerrar(aviso.id), DURACION_MS);
    },
    [cerrar],
  );

  const { data } = useQuery({
    queryKey: ['admin', 'orders', 'ultimos'],
    queryFn: () => api<{ items: OrderSummaryDto[] }>('/admin/orders?page=1&perPage=5'),
    refetchInterval: INTERVALO_MS,
    // Sin esto seguiría consultando con la pestaña en segundo plano; para eso
    // está la notificación del sistema.
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    if (!data?.items) return;

    if (conocidos.current === null) {
      conocidos.current = new Set(data.items.map((o) => o.id));
      return;
    }

    for (const orden of [...data.items].reverse()) {
      if (conocidos.current.has(orden.id)) continue;
      conocidos.current.add(orden.id);
      mostrar({
        id: orden.id,
        numero: orden.displayNumber,
        cliente: orden.contactName,
        total: formatCentsAsArs(orden.totalCents),
        href: `/dashboard/pedidos/${orden.id}`,
      });
    }
  }, [data, mostrar]);

  // Aviso instantáneo desde el service worker cuando entra un push.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const alRecibir = (evento: MessageEvent) => {
      const dato = evento.data;
      if (!dato || dato.tipo !== 'pedido-nuevo') return;
      const id = String(dato.orderId ?? dato.url ?? Date.now());
      if (conocidos.current?.has(id)) return;
      conocidos.current?.add(id);
      mostrar({
        id,
        numero: String(dato.titulo ?? 'Nuevo pedido'),
        cliente: String(dato.cuerpo ?? ''),
        total: '',
        href: String(dato.url ?? '/dashboard/pedidos'),
      });
    };

    navigator.serviceWorker.addEventListener('message', alRecibir);
    return () => navigator.serviceWorker.removeEventListener('message', alRecibir);
  }, [mostrar]);

  if (avisos.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed right-4 z-50 flex w-[min(21rem,calc(100vw-2rem))] flex-col gap-2"
      style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      role="status"
      aria-live="polite"
    >
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className="pointer-events-auto flex items-start gap-3 rounded-lg border border-border bg-background p-3 shadow-lg"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Nuevo pedido {aviso.numero}</p>
            {aviso.cliente && <p className="truncate text-sm text-muted-foreground">{aviso.cliente}</p>}
            {aviso.total && <p className="text-sm font-medium tabular-nums">{aviso.total}</p>}
            <Link
              href={aviso.href}
              onClick={() => cerrar(aviso.id)}
              className="mt-1 inline-block text-xs font-semibold text-primary hover:underline"
            >
              Ver pedido
            </Link>
          </div>

          <button
            type="button"
            onClick={() => cerrar(aviso.id)}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
