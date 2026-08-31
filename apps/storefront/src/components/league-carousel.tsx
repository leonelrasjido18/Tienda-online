'use client';

import Link from 'next/link';

import { resolveImageUrl } from '@/lib/media';

export interface LeagueCarouselItem {
  slug: string;
  name: string;
  count: number;
  logoUrl: string | null;
}

/** Carrusel de ligas con desplazamiento continuo (pausa al pasar el mouse). */
export function LeagueCarousel({ items }: { items: LeagueCarouselItem[] }) {
  if (items.length === 0) return null;
  // La lista se duplica para que el bucle sea continuo con translateX(-50%).
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden py-2">
      <div className="league-marquee flex w-max gap-4">
        {loop.map((league, i) => (
          <Link
            key={`${league.slug}-${i}`}
            href={`/productos?leagueSlug=${league.slug}`}
            aria-label={league.name}
            className="flex w-36 shrink-0 flex-col items-center justify-center rounded-xl border border-border bg-background p-4 text-center transition-colors hover:border-accent"
          >
            {league.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resolveImageUrl(league.logoUrl)} alt={league.name} className="h-14 w-14 object-contain" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-lg font-bold text-foreground">
                {league.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <span className="mt-3 text-sm font-semibold text-foreground">{league.name}</span>
            <span className="mt-0.5 text-xs text-muted-foreground">{league.count} productos</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
