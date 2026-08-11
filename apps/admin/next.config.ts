import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@tienda/ui'],
  // Oculta el indicador de desarrollo de Next (la "N" flotante). Sólo aparece en dev.
  devIndicators: false,
};

export default nextConfig;
