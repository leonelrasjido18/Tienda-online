'use client';

import type { ActivePreorderWindowDto } from '@tienda/shared';
import { useEffect, useState } from 'react';

/**
 * Barra superior con la cuenta regresiva de la ventana de encargo activa.
 * El "ahora" se setea recién en el cliente (dentro de callbacks async) para no
 * romper la hidratación ni disparar setState síncrono en efecto.
 */
export function PreorderBanner({ window }: { window: ActivePreorderWindowDto | null }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const first = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  if (!window || now === null) return null;

  const remaining = new Date(window.closesAt).getTime() - now;
  if (remaining <= 0) return null;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  const parts = [days ? `${days}d` : null, `${hours}h`, `${mins}m`, `${secs}s`].filter(Boolean).join(' ');
  const eta = window.promisedDeliveryDays;

  return (
    <div className="bg-accent px-4 py-2 text-center text-xs font-medium text-accent-foreground sm:text-sm">
      ⏳ Encargos abiertos — cierran en <span className="font-bold tabular-nums">{parts}</span>
      {eta ? <span className="hidden sm:inline"> · comprá ahora y te llega en ~{eta} días</span> : null}
    </div>
  );
}
