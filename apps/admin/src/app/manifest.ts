import type { MetadataRoute } from 'next';

// Icono placeholder: se reemplaza por el logo real de la clienta en una fase posterior.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Panel de administración — Tienda',
    short_name: 'Tienda Admin',
    description: 'Panel de administración de pedidos, productos y ventas',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#171717',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  };
}
