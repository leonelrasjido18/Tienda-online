'use client';

import type { ProductDetailDto } from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { useApi } from '@/lib/use-api';
import { ProductCustomizationEditor } from './product-customization-editor';
import { ProductGeneralForm } from './product-general-form';
import { ProductImagesManager } from './product-images-manager';
import { ProductOptionsEditor } from './product-options-editor';
import { ProductSaveBusProvider } from './product-save-bus';
import { ProductSaveHeader } from './product-save-header';
import { ProductVariantsGrid } from './product-variants-grid';

export default function ProductEditorPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;
  const api = useApi();

  const { data: product, isLoading } = useQuery({
    queryKey: ['admin', 'products', productId],
    queryFn: () => api<ProductDetailDto>(`/admin/products/${productId}`),
  });

  if (isLoading || !product) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  return (
    <ProductSaveBusProvider>
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">/{product.slug}</p>
        </div>
        <ProductSaveHeader productId={productId} />
      </div>

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Datos generales
        </h2>
        <ProductGeneralForm productId={productId} product={product} />
      </section>

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Talles y variantes
        </h2>
        {/* La `key` remonta el editor cuando el servidor devuelve otras opciones,
            igual que la grilla de abajo. Sin esto, la carga rápida creaba la opción
            Manga en la base, pero el editor seguía mostrando por dentro las opciones
            viejas; al tocar "Guardar y volver" las reenviaba y borraba la Manga
            recién creada, con sus variantes. Quedaba como si nunca se hubiera
            generado nada. */}
        <ProductOptionsEditor
          key={product.options.map((o) => `${o.name}:${o.values.map((v) => v.value).join('/')}`).join('|')}
          productId={productId}
          options={product.options}
        />
        <div className="mt-6 border-t border-border pt-6">
          <ProductVariantsGrid
            key={product.variants.map((v) => v.id).join(',')}
            productId={productId}
            variants={product.variants}
            options={product.options}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Fotos</h2>
        <ProductImagesManager productId={productId} images={product.images} options={product.options} />
      </section>

      <section className="rounded-lg border border-border bg-background p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Personalización (nombre, dorsal y parches)
        </h2>
        <ProductCustomizationEditor
          key={product.customization?.id ?? 'none'}
          productId={productId}
          product={product}
        />
      </section>
    </div>
    </ProductSaveBusProvider>
  );
}
