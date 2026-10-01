import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { ThemeScript } from '@tienda/ui';

import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { PreorderBanner } from '@/components/preorder-banner';
import { AnalyticsScripts } from '@/components/analytics-scripts';
import { CartProvider } from '@/lib/cart-context';
import { FavoritosProvider } from '@/lib/favoritos-context';
import { getPreorderWindow } from '@/lib/api-safe';
import { siteConfig } from '@/lib/site-config';

import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — Camisetas de fútbol`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: 'website',
    locale: siteConfig.locale,
    siteName: siteConfig.name,
    description: siteConfig.description,
  },
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  const preorderWindow = await getPreorderWindow();
  return (
    <html lang="es" className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <AnalyticsScripts />
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <CartProvider>
          <FavoritosProvider>
          <PreorderBanner window={preorderWindow} />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          </FavoritosProvider>
        </CartProvider>
      </body>
    </html>
  );
}
