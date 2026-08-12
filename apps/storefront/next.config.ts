import path from 'node:path';

import type { NextConfig } from 'next';

// Las fotos de producto las sirve la API (`/uploads/...`), no Next.js. `next/image`
// exige declarar ese host explícitamente, así que se deriva de la misma variable que
// usa `resolveImageUrl()` para que dev y producción queden siempre en sincronía.
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

// Next 16 bloquea optimizar imágenes servidas desde IPs privadas (protección SSRF).
// En desarrollo la API vive en localhost, así que hay que habilitarlo explícitamente;
// en producción la API está en un dominio público y el permiso no se otorga.
const isLocalApi = ['localhost', '127.0.0.1', '::1'].includes(apiUrl.hostname);

const nextConfig: NextConfig = {
  transpilePackages: ['@tienda/ui'],
  // Build autocontenido para la imagen Docker (server + node_modules mínimos). En un
  // monorepo hay que apuntar la raíz de trazado al root para que incluya los paquetes
  // del workspace (@tienda/ui, @tienda/shared).
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Oculta el indicador de desarrollo de Next (la "N" flotante). Sólo aparece en dev.
  devIndicators: false,
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: '/uploads/**',
      },
    ],
    dangerouslyAllowLocalIP: isLocalApi,
  },
};

export default nextConfig;
