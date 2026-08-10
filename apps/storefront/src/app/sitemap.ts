import type { MetadataRoute } from 'next';
import { apiFetchSafe } from '@/lib/api-safe';
import { siteConfig } from '@/lib/site-config';
import type { Paginated, ProductListItemDto, ProductFacetsDto } from '@tienda/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;

  // Static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/productos`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/como-funciona`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${baseUrl}/preguntas-frecuentes`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/cambios-y-devoluciones`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/envios`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terminos`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/contacto`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/guia-de-talles`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
  ];

  // Dynamic product routes
  const productsData = await apiFetchSafe<Paginated<ProductListItemDto>>('/catalog/products?perPage=100');
  const productRoutes: MetadataRoute.Sitemap = (productsData?.items ?? []).map((p) => ({
    url: `${baseUrl}/productos/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Dynamic league routes
  const facetsData = await apiFetchSafe<ProductFacetsDto>('/catalog/facets');
  const leagueRoutes: MetadataRoute.Sitemap = (facetsData?.leagues ?? []).map((l) => ({
    url: `${baseUrl}/productos?leagueSlug=${l.value}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...productRoutes, ...leagueRoutes];
}
