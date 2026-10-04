import {
  bestPaymentDiscount,
  formatCentsAsArs,
  type PaymentDiscountSettings,
  type ProductListItemDto,
} from '@tienda/shared';
import Link from 'next/link';

import { resolveImageUrl } from '@/lib/media';

/** Cómo se nombra el medio de pago en el aviso: corto, porque la tarjeta es angosta. */
const MEDIO_CORTO = { bank_transfer: 'transferencia', cash: 'efectivo' } as const;

export function ProductCard({
  product,
  descuentos,
}: {
  product: ProductListItemDto;
  /** Descuentos por medio de pago configurados. Sin esto, la tarjeta no anuncia nada. */
  descuentos?: PaymentDiscountSettings;
}) {
  const isPreorderOnly = product.fulfillmentMode === 'PREORDER' || product.totalAvailable === 0;

  // Mismo cálculo que la ficha y el checkout (`bestPaymentDiscount`): lo que se
  // anuncia acá es lo que se cobra al pagar.
  const promo =
    descuentos && product.minPriceCents !== null && product.minPriceCents > 0
      ? bestPaymentDiscount(product.minPriceCents, descuentos)
      : null;
  const porcentaje = promo && product.minPriceCents ? Math.round((promo.discountCents / product.minPriceCents) * 100) : 0;

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

        {promo && (
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md bg-accent/10 px-2 py-1.5 text-xs leading-tight">
            {porcentaje > 0 && (
              <span className="rounded bg-accent px-1 py-0.5 text-[10px] font-bold text-accent-foreground">
                {porcentaje}% OFF
              </span>
            )}
            <span className="font-bold text-accent">{formatCentsAsArs(promo.finalCents)}</span>
            <span className="text-muted-foreground">con {MEDIO_CORTO[promo.method]}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
