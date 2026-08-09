import { productListQuerySchema, type ProductFacetsDto, type Paginated, type ProductListItemDto } from '@tienda/shared';
import { Input, buttonVariants } from '@tienda/ui';

import { apiFetch } from '@/lib/api';
import { ProductCard } from '@/components/product-card';
import { ProductFilters } from '@/components/product-filters';

export const metadata = { title: 'Productos — Tienda' };

function buildQueryString(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return search.toString();
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
    sort: query.sort,
    page: String(query.page),
  });
  const facetsQs = buildQueryString({ q: query.q, leagueSlug: query.leagueSlug, categorySlug: query.categorySlug });

  const [result, facets] = await Promise.all([
    apiFetch<Paginated<ProductListItemDto>>(`/catalog/products?${listQs}`),
    apiFetch<ProductFacetsDto>(`/catalog/facets?${facetsQs}`),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <form method="GET" className="mb-6 flex max-w-md gap-2">
        <Input type="search" name="q" placeholder="Buscar camisetas, equipos..." defaultValue={query.q ?? ''} />
        <button type="submit" className={buttonVariants({ variant: 'outline' })}>
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
        <ProductFilters facets={facets} />

        <div>
          <p className="mb-4 text-sm text-muted-foreground">{result.total} productos</p>

          {result.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No encontramos productos con esos filtros.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {result.totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((page) => (
                <a
                  key={page}
                  href={`/productos?${buildQueryString({ ...Object.fromEntries(new URLSearchParams(listQs)), page: String(page) })}`}
                  className={buttonVariants({ variant: page === query.page ? 'default' : 'outline', size: 'sm' })}
                >
                  {page}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
