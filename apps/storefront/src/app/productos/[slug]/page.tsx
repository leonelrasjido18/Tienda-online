import type { ProductDetailDto, ProductListItemDto, ReviewSummaryDto } from '@tienda/shared';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { apiFetch, ApiNotFoundError } from '@/lib/api';
import { siteConfig } from '@/lib/site-config';
import { ProductCard } from '@/components/product-card';
import { VariantSelector } from './variant-selector';
import { ProductReviews } from './product-reviews';

const EMPTY_REVIEWS: ReviewSummaryDto = { average: 0, count: 0, reviews: [] };

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

/** Relacionados: si la API falla, la ficha no se cae, sólo no muestra la sección. */
async function getRelated(slug: string): Promise<ProductListItemDto[]> {
  try {
    return await apiFetch<ProductListItemDto[]>(`/catalog/products/${slug}/related`);
  } catch {
    return [];
  }
}

/** Reseñas aprobadas para SEO/hidratación inicial; tolera fallos de la API. */
async function getReviews(slug: string): Promise<ReviewSummaryDto> {
  try {
    return await apiFetch<ReviewSummaryDto>(`/catalog/products/${slug}/reviews`);
  } catch {
    return EMPTY_REVIEWS;
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
  const [product, related, reviews] = await Promise.all([getProduct(slug), getRelated(slug), getReviews(slug)]);

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
    ...(reviews.count > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: reviews.average,
            reviewCount: reviews.count,
          },
        }
      : {}),
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

      <ProductReviews productId={product.id} initial={reviews} />

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-5 text-xl font-bold tracking-tight text-foreground">También te puede gustar</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
