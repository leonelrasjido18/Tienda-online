/**
 * Configuración centralizada del sitio.
 * Cambiar estos valores se refleja en header, footer, home, SEO y meta tags.
 */
export const siteConfig = {
  name: 'Remeras del Área',
  description:
    'Camisetas de fútbol importadas con personalización de nombre y dorsal. Entrega inmediata o por encargo desde China.',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
  locale: 'es_AR',
  currency: 'ARS',
} as const;

/**
 * Filas de productos por liga en el home.
 * Cada entrada es un slug de liga → se consulta /catalog/products?leagueSlug=...&sort=newest
 */
export const HOME_RAILS: { leagueSlug: string; title: string }[] = [
  { leagueSlug: 'premier-league', title: 'Premier League' },
  { leagueSlug: 'la-liga', title: 'La Liga' },
  { leagueSlug: 'serie-a', title: 'Serie A' },
];
