'use client';

import type { ProductFacetsDto } from '@tienda/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button, Input, Separator } from '@tienda/ui';
import { FilterX } from 'lucide-react';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'newest', label: 'Más nuevo' },
  { value: 'price_asc', label: 'Precio: menor a mayor' },
  { value: 'price_desc', label: 'Precio: mayor a menor' },
];

export function ProductFilters({
  facets,
  onApplyMobile,
}: {
  facets: ProductFacetsDto;
  onApplyMobile?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeLeague = searchParams.get('leagueSlug');
  const activeTeam = searchParams.get('teamSlug');
  const activeSize = searchParams.get('size');
  const activeSort = searchParams.get('sort') ?? 'newest';
  const activeMinPrice = searchParams.get('minPrice') ?? '';
  const activeMaxPrice = searchParams.get('maxPrice') ?? '';

  const [minPriceInput, setMinPriceInput] = useState(activeMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState(activeMaxPrice);

  // La URL manda: si cambia desde afuera (ej. "Limpiar filtros"), los inputs se
  // resincronizan. Se ajusta durante el render en vez de en un efecto para no
  // provocar un segundo render en cascada.
  const [syncedPrices, setSyncedPrices] = useState({ min: activeMinPrice, max: activeMaxPrice });
  if (syncedPrices.min !== activeMinPrice || syncedPrices.max !== activeMaxPrice) {
    setSyncedPrices({ min: activeMinPrice, max: activeMaxPrice });
    setMinPriceInput(activeMinPrice);
    setMaxPriceInput(activeMaxPrice);
  }

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
    if (onApplyMobile) onApplyMobile();
  }

  function handlePriceFilter(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (minPriceInput) {
      params.set('minPrice', minPriceInput);
    } else {
      params.delete('minPrice');
    }
    if (maxPriceInput) {
      params.set('maxPrice', maxPriceInput);
    } else {
      params.delete('maxPrice');
    }
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
    if (onApplyMobile) onApplyMobile();
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    const q = searchParams.get('q');
    if (q) params.set('q', q);
    router.push(`${pathname}?${params.toString()}`);
    if (onApplyMobile) onApplyMobile();
  }

  const hasActiveFilters = Boolean(
    activeLeague || activeTeam || activeSize || activeMinPrice || activeMaxPrice || (activeSort && activeSort !== 'newest')
  );

  return (
    <aside className="space-y-6">
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Filtros activos</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive gap-1"
          >
            <FilterX className="h-3.5 w-3.5" /> Limpiar todo
          </Button>
        </div>
      )}

      {/* Ordenar */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Ordenar por</h3>
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
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

      <Separator />

      {/* Precio */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">Precio ($ ARS)</h3>
        <form onSubmit={handlePriceFilter} className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Mín"
              value={minPriceInput}
              onChange={(e) => setMinPriceInput(e.target.value)}
              className="h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">-</span>
            <Input
              type="number"
              placeholder="Máx"
              value={maxPriceInput}
              onChange={(e) => setMaxPriceInput(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <Button type="submit" variant="outline" size="sm" className="w-full h-8 text-xs">
            Aplicar precio
          </Button>
        </form>
      </div>

      {facets.leagues.length > 0 && (
        <>
          <Separator />
          <FilterGroup
            title="Liga"
            options={facets.leagues}
            activeValue={activeLeague}
            onSelect={(value) => setParam('leagueSlug', value)}
          />
        </>
      )}

      {facets.teams.length > 0 && (
        <>
          <Separator />
          <FilterGroup
            title="Equipo"
            options={facets.teams}
            activeValue={activeTeam}
            onSelect={(value) => setParam('teamSlug', value)}
          />
        </>
      )}

      {facets.sizes.length > 0 && (
        <>
          <Separator />
          <FilterGroup
            title="Talle"
            options={facets.sizes}
            activeValue={activeSize}
            onSelect={(value) => setParam('size', value)}
          />
        </>
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
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {options.map((option) => {
          const active = activeValue === option.value;
          return (
            <li key={option.value}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : option.value)}
                className={
                  'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ' +
                  (active
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground')
                }
              >
                <span className="truncate">{option.label}</span>
                <span className="ml-2 text-xs opacity-70">{option.count}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
