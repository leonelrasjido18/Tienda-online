import path from 'node:path';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tienda/ui'],
  // Build autocontenido para la imagen Docker; en monorepo la raíz de trazado va al root.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // Oculta el indicador de desarrollo de Next (la "N" flotante). Sólo aparece en dev.
  devIndicators: false,
};

export default nextConfig;
