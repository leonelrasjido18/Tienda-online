import type { ProductDetailDto } from '@tienda/shared';
import { notFound } from 'next/navigation';

import { apiFetch, ApiNotFoundError } from '@/lib/api';
import { VariantSelector } from './variant-selector';

async function getProduct(slug: string) {
  try {
    return await apiFetch<ProductDetailDto>(`/catalog/products/${slug}`);
  } catch (err) {
    if (err instanceof ApiNotFoundError) {
      return null;
    }
    throw err;
  }
}

export async function generateMetadata({ params }: PageProps<'/productos/[slug]'>) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    return { title: 'Producto no encontrado' };
  }
  return {
    title: product.seoTitle ?? `${product.name} — Tienda`,
    description: product.seoDescription ?? product.description ?? undefined,
  };
}

export default async function ProductPage({ params }: PageProps<'/productos/[slug]'>) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <VariantSelector product={product} />
    </div>
  );
}
