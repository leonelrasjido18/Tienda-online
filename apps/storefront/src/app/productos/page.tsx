import Link from 'next/link';
import { SlidersHorizontal, Search } from 'lucide-react';
import { productListQuerySchema, type ProductFacetsDto, type Paginated, type ProductListItemDto } from '@tienda/shared';
import { Input, buttonVariants, Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@tienda/ui';

import { apiFetch } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';

export const metadata = { title: 'Catálogo de Productos — Tienda' };

function buildQueryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

function getPaginationPages(currentPage: number, totalPages: number) {
  const pages: (number | '...')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }
  return pages;
}

export default async function ProductsPage({ searchParams }: PageProps<'/productos'>) {
  const rawParams = await searchParams;
  const toSingle = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const query = productListQuerySchema.parse({
    q: toSingle(rawParams.q),
    leagueSlug: toSingle(rawParams.leagueSlug),
    teamSlug: toSingle(rawParams.teamSlug),
    categorySlug: toSingle(rawParams.categorySlug),
    seasonId: toSingle(rawParams.seasonId),
    size: toSingle(rawParams.size),
    minPrice: toSingle(rawParams.minPrice),
    maxPrice: toSingle(rawParams.maxPrice),
    sort: toSingle(rawParams.sort),
    page: toSingle(rawParams.page),
  });

  const listQs = buildQueryString({
    q: query.q,
    leagueSlug: query.leagueSlug,
    teamSlug: query.teamSlug,
    categorySlug: query.categorySlug,
    seasonId: query.seasonId,
    size: query.size,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
    sort: query.sort,
    page: String(query.page),
  });

  const facetsQs = buildQueryString({
    q: query.q,
    leagueSlug: query.leagueSlug,
    teamSlug: query.teamSlug,
    categorySlug: query.categorySlug,
    seasonId: query.seasonId,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice,
  });

  const [result, facets] = await Promise.all([
    apiFetch<Paginated<ProductListItemDto>>(`/catalog/products?${listQs}`),
    apiFetch<ProductFacetsDto>(`/catalog/facets?${facetsQs}`),
  ]);

  const activeFilterCount = [
    query.leagueSlug,
    query.teamSlug,
    query.size,
    query.minPrice,
    query.maxPrice,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header bar with Search and Mobile Filter Trigger */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form method="GET" className="flex flex-1 max-w-md gap-2">
          {/* Hidden inputs to maintain active filters when performing a search */}
          {query.leagueSlug && <input type="hidden" name="leagueSlug" value={query.leagueSlug} />}
          {query.teamSlug && <input type="hidden" name="teamSlug" value={query.teamSlug} />}
          {query.categorySlug && <input type="hidden" name="categorySlug" value={query.categorySlug} />}
          {query.size && <input type="hidden" name="size" value={query.size} />}
          {query.minPrice !== undefined && <input type="hidden" name="minPrice" value={query.minPrice} />}
          {query.maxPrice !== undefined && <input type="hidden" name="maxPrice" value={query.maxPrice} />}
          {query.sort && query.sort !== 'newest' && <input type="hidden" name="sort" value={query.sort} />}

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              name="q"
              placeholder="Buscar camisetas, equipos..."
              defaultValue={query.q ?? ''}
              className="pl-9"
            />
          </div>
          <button type="submit" className={buttonVariants({ variant: 'default' })}>
            Buscar
          </button>
        </form>

        {/* Mobile Filter Drawer Button */}
        <div className="flex items-center justify-between sm:hidden">
          <p className="text-sm font-medium text-muted-foreground">{result.total} productos</p>
          <Sheet>
            <SheetTrigger className={buttonVariants({ variant: 'outline', size: 'sm', className: 'gap-2' })}>
              <SlidersHorizontal className="h-4 w-4" /> Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground">
                  {activeFilterCount}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="left" className="w-80 overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filtros de búsqueda</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <ProductFilters facets={facets} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        {/* Desktop Filters Sidebar */}
        <div className="hidden md:block">
          <ProductFilters facets={facets} />
        </div>

        {/* Product Grid */}
        <div>
          <div className="hidden sm:flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">{result.total} productos encontrados</p>
          </div>

          {result.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center">
              <p className="text-base font-semibold text-foreground">No encontramos productos con esos filtros</p>
              <p className="mt-1 text-sm text-muted-foreground">Intentá cambiar los términos de búsqueda o limpiar las opciones seleccionadas.</p>
              <Link href="/productos" className={buttonVariants({ variant: 'outline', className: 'mt-4' })}>
                Ver todos los productos
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Truncated Pagination with Next.js Link */}
          {result.totalPages > 1 && (
            <div className="mt-10 flex justify-center items-center gap-1.5">
              {getPaginationPages(query.page, result.totalPages).map((page, idx) => {
                if (page === '...') {
                  return (
                    <span key={`dots-${idx}`} className="px-2 text-sm text-muted-foreground">
                      …
                    </span>
                  );
                }
                const pageQs = buildQueryString({
                  q: query.q,
                  leagueSlug: query.leagueSlug,
                  teamSlug: query.teamSlug,
                  categorySlug: query.categorySlug,
                  seasonId: query.seasonId,
                  size: query.size,
                  minPrice: query.minPrice,
                  maxPrice: query.maxPrice,
                  sort: query.sort === 'newest' ? undefined : query.sort,
                  page: page === 1 ? undefined : String(page),
                });

                const isCurrent = page === query.page;

                return (
                  <Link
                    key={page}
                    href={`/productos?${pageQs}`}
                    className={buttonVariants({
                      variant: isCurrent ? 'default' : 'outline',
                      size: 'sm',
                      className: 'h-9 w-9 p-0 font-medium',
                    })}
                  >
                    {page}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
