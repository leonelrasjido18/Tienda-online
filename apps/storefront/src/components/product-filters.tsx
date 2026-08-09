'use client';

import type { ProductFacetsDto } from '@tienda/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Más nuevo' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

export function ProductFilters({ facets }: { facets: ProductFacetsDto }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  }

  const activeLeague = searchParams.get('leagueSlug');
  const activeTeam = searchParams.get('teamSlug');
  const activeSize = searchParams.get('size');
  const activeSort = searchParams.get('sort') ?? 'newest';

  return (
    <aside className="space-y-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Ordenar</h3>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={activeSort}
          onChange={(e) => setParam('sort', e.target.value === 'newest' ? null : e.target.value)}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {facets.leagues.length > 0 && (
        <FilterGroup
          title="Liga"
          options={facets.leagues}
          activeValue={activeLeague}
          onSelect={(value) => setParam('leagueSlug', value)}
        />
      )}

      {facets.teams.length > 0 && (
        <FilterGroup
          title="Equipo"
          options={facets.teams}
          activeValue={activeTeam}
          onSelect={(value) => setParam('teamSlug', value)}
        />
      )}

      {facets.sizes.length > 0 && (
        <FilterGroup
          title="Talle"
          options={facets.sizes}
          activeValue={activeSize}
          onSelect={(value) => setParam('size', value)}
        />
      )}
    </aside>
  );
}

function FilterGroup({
  title,
  options,
  activeValue,
  onSelect,
}: {
  title: string;
  options: { value: string; label: string; count: number }[];
  activeValue: string | null;
  onSelect: (value: string | null) => void;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1">
        {options.map((option) => {
          const active = activeValue === option.value;
          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : option.value)}
                className={
                  'flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm ' +
                  (active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')
                }
              >
                <span>{option.label}</span>
                <span className="text-xs opacity-70">{option.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
