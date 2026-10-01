'use client';

import { formatCentsAsArs } from '@tienda/shared';
import { Heart, X } from 'lucide-react';
import Link from 'next/link';

import { useFavoritos } from '@/lib/favoritos-context';

export default function FavoritosPage() {
  const { favoritos, quitar, listo } = useFavoritos();

  // Hasta leer el navegador no se sabe si hay favoritos; mostrar "no tenés
  // ninguno" mientras tanto sería mentira por una fracción de segundo.
  if (!listo) {
    return <p className="mx-auto max-w-5xl px-4 py-10 text-sm text-muted-foreground">Cargando…</p>;
  }

  if (favoritos.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <Heart className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-bold">Todavía no guardaste ninguna</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tocá el corazón en cualquier camiseta para tenerla a mano.
        </p>
        <Link
          href="/productos"
          className="mt-6 inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Ver el catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-extrabold tracking-tight">Mis favoritas</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {favoritos.length} {favoritos.length === 1 ? 'camiseta guardada' : 'camisetas guardadas'} en este
        navegador.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {favoritos.map((f) => (
          <div key={f.slug} className="group relative overflow-hidden rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => quitar(f.slug)}
              aria-label={`Quitar ${f.name} de favoritos`}
              className="absolute right-2 top-2 z-10 rounded-full bg-background/90 p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-destructive"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <Link href={`/productos/${f.slug}`}>
              <div className="aspect-square bg-muted">
                {f.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-medium">{f.name}</p>
                {f.priceCents !== null && (
                  <p className="mt-1 text-sm font-bold tabular-nums">{formatCentsAsArs(f.priceCents)}</p>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
