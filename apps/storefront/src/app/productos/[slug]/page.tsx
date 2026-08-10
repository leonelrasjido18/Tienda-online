import type { ProductDetailDto } from '@tienda/shared';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { apiFetch, ApiNotFoundError } from '@/lib/api';
import { siteConfig } from '@/lib/site-config';
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

  const title = product.seoTitle ?? `${product.name} — ${siteConfig.name}`;
  const description = product.seoDescription ?? product.description ?? siteConfig.description;
  const coverImage = product.images[0]?.url ? `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${product.images[0].url}` : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: coverImage ? [{ url: coverImage }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<'/productos/[slug]'>) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  // JSON-LD for Search Engines
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description ?? undefined,
    image: product.images.map((img) => `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}${img.url}`),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'ARS',
      price: product.variants[0] ? (product.variants[0].priceCents / 100).toFixed(2) : '0',
      availability: product.fulfillmentMode === 'PREORDER' ? 'https://schema.org/PreOrder' : 'https://schema.org/InStock',
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumbs */}
      <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/productos" className="hover:text-foreground transition-colors">Productos</Link>
        {product.league && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/productos?leagueSlug=${product.league.slug}`} className="hover:text-foreground transition-colors">
              {product.league.name}
            </Link>
          </>
        )}
        {product.team && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link href={`/productos?teamSlug=${product.team.slug}`} className="hover:text-foreground transition-colors">
              {product.team.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="truncate font-medium text-foreground">{product.name}</span>
      </nav>

      <VariantSelector product={product} />
    </div>
  );
}
