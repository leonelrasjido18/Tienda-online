import { formatCentsAsArs, type ProductListItemDto } from '@tienda/shared';
import Link from 'next/link';

import { resolveImageUrl } from '@/lib/media';

export function ProductCard({ product }: { product: ProductListItemDto }) {
  const isPreorderOnly = product.fulfillmentMode === 'PREORDER' || product.totalAvailable === 0;

  return (
    <Link
      href={`/productos/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-border bg-background"
    >
      <div className="aspect-square w-full overflow-hidden bg-muted">
        {product.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolveImageUrl(product.coverImageUrl)}
            alt={product.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin foto</div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-muted-foreground">{[product.leagueName, product.teamName].filter(Boolean).join(' · ')}</p>
        <h3 className="mt-0.5 line-clamp-2 text-sm font-medium">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-semibold">
            {product.minPriceCents !== null ? formatCentsAsArs(product.minPriceCents) : 'Consultar'}
          </span>
          {isPreorderOnly && <span className="text-xs text-muted-foreground">Por encargo</span>}
        </div>
      </div>
    </Link>
  );
}
