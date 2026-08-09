'use client';

import type { ProductDetailDto } from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';

import { useApi } from '@/lib/use-api';
import { ProductGeneralForm } from './product-general-form';
import { ProductImagesManager } from './product-images-manager';
import { ProductOptionsEditor } from './product-options-editor';
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
    <div className="mx-auto max-w-4xl space-y-8 pb-16">
      <div>
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <p className="text-sm text-muted-foreground">/{product.slug}</p>
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
        <ProductOptionsEditor productId={productId} options={product.options} />
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
    </div>
  );
}
