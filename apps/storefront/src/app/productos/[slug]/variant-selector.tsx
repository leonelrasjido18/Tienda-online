'use client';

import { formatCentsAsArs, type ProductDetailDto } from '@tienda/shared';
import { buttonVariants } from '@tienda/ui';
import { useMemo, useState } from 'react';

type VariantDto = ProductDetailDto['variants'][number];

function combinationKey(ids: string[]): string {
  return [...ids].sort().join('|');
}

export function VariantSelector({ product }: { product: ProductDetailDto }) {
  const firstVariant = product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    if (!firstVariant) return {};
    const map: Record<string, string> = {};
    for (const option of product.options) {
      const value = option.values.find((v) => firstVariant.optionValueIds.includes(v.id));
      if (value) map[option.id] = value.id;
    }
    return map;
  });

  const variantByKey = useMemo(() => {
    const map = new Map<string, VariantDto>();
    for (const variant of product.variants) {
      map.set(combinationKey(variant.optionValueIds), variant);
    }
    return map;
  }, [product.variants]);

  const selectedIds = Object.values(selected);
  const hasFullSelection = selectedIds.length === product.options.length;
  const activeVariant = hasFullSelection ? variantByKey.get(combinationKey(selectedIds)) : undefined;

  const images = product.images.length > 0 ? product.images : [];
  const selectedImage =
    images.find((img) => img.optionValueId && selectedIds.includes(img.optionValueId)) ?? images[0];

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      <div>
        <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {selectedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedImage.url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sin foto</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex gap-2">
            {images.map((image) => (
              <div key={image.id} className="h-16 w-16 overflow-hidden rounded border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-sm text-muted-foreground">
          {[product.league?.name, product.team?.name, product.season?.label].filter(Boolean).join(' · ')}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{product.name}</h1>

        <p className="mt-4 text-3xl font-bold">
          {activeVariant ? formatCentsAsArs(activeVariant.priceCents) : 'Elegí las opciones'}
        </p>

        {product.options.map((option) => (
          <div key={option.id} className="mt-6">
            <p className="mb-2 text-sm font-medium">{option.name}</p>
            <div className="flex flex-wrap gap-2">
              {option.values.map((value) => {
                const active = selected[option.id] === value.id;
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => setSelected((s) => ({ ...s, [option.id]: value.id }))}
                    className={
                      'rounded-md border px-3 py-1.5 text-sm ' +
                      (active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input bg-background hover:bg-accent')
                    }
                  >
                    {value.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mt-6">
          <AvailabilityBadge product={product} variant={activeVariant} />
        </div>

        <button
          type="button"
          disabled={!activeVariant || activeVariant.inventory.available <= 0}
          className={buttonVariants({ className: 'mt-6 w-full' })}
        >
          {activeVariant?.inventory.available && activeVariant.inventory.available > 0
            ? 'Agregar al carrito'
            : activeVariant?.inventory.allowPreorder
              ? 'Pedir por encargo'
              : 'Sin stock'}
        </button>

        {product.description && (
          <div className="mt-8 border-t border-border pt-6 text-sm text-muted-foreground">
            <p className="whitespace-pre-line">{product.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AvailabilityBadge({ product, variant }: { product: ProductDetailDto; variant: VariantDto | undefined }) {
  if (!variant) {
    return <p className="text-sm text-muted-foreground">Elegí talle para ver disponibilidad.</p>;
  }
  if (variant.inventory.available > 0) {
    return <p className="text-sm text-emerald-600">Entrega inmediata</p>;
  }
  if (variant.inventory.allowPreorder) {
    const days = variant.inventory.preorderLeadDays ?? product.preorderLeadDays;
    return (
      <p className="text-sm text-muted-foreground">
        Por encargo{days ? ` · llega en ~${days} días` : ''}
      </p>
    );
  }
  return <p className="text-sm text-destructive">Sin stock</p>;
}
