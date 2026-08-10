import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

// El negro de marca (el mismo del logo y de los íconos generados).
const BRAND_BLACK = '#05070d';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: 'Del Área',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    lang: 'es-AR',
    background_color: BRAND_BLACK,
    theme_color: BRAND_BLACK,
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
