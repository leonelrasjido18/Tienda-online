import Link from 'next/link';
import { Separator } from '@tienda/ui';

import { getStoreSettings } from '@/lib/api-safe';
import { siteConfig } from '@/lib/site-config';

const SHOP_LINKS = [
  { href: '/productos', label: 'Todos los productos' },
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/guia-de-talles', label: 'Guía de talles' },
];

const HELP_LINKS = [
  { href: '/preguntas-frecuentes', label: 'Preguntas frecuentes' },
  { href: '/envios', label: 'Envíos' },
  { href: '/cambios-y-devoluciones', label: 'Cambios y devoluciones' },
  { href: '/contacto', label: 'Contacto' },
];

const LEGAL_LINKS = [
  { href: '/terminos', label: 'Términos y condiciones' },
];

export async function SiteFooter() {
  const settings = await getStoreSettings();

  const whatsappUrl = settings.whatsappPhone
    ? `https://wa.me/${settings.whatsappPhone.replace(/\D/g, '')}${settings.whatsappMessage ? `?text=${encodeURIComponent(settings.whatsappMessage)}` : ''}`
    : null;
  const instagramUrl = settings.instagramUser
    ? `https://instagram.com/${settings.instagramUser}`
    : null;

  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-[1600px] px-4 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="text-lg font-bold tracking-tight">
              {siteConfig.name}
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Camisetas de fútbol importadas con personalización. Entrega inmediata o por encargo.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="text-sm font-semibold">Tienda</h3>
            <ul className="mt-3 space-y-2">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="text-sm font-semibold">Ayuda</h3>
            <ul className="mt-3 space-y-2">
              {HELP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold">Contacto</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {whatsappUrl && (
                <li>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                    WhatsApp
                  </a>
                </li>
              )}
              {instagramUrl && (
                <li>
                  <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">
                    @{settings.instagramUser}
                  </a>
                </li>
              )}
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`} className="transition-colors hover:text-foreground">
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.pickupAddress && (
                <li className="pt-1">
                  <p className="text-xs font-medium text-foreground">Retiro en el local</p>
                  <p className="text-xs">{settings.pickupAddress}</p>
                  {settings.openingHours && <p className="text-xs">{settings.openingHours}</p>}
                </li>
              )}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.name}. Todos los derechos reservados.
          </p>
          <div className="flex items-center gap-4">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {/* Acceso al panel de gestión (dueña/staff). En producción esta URL
                apunta al mismo dominio, ej. /panel; en dev, al puerto del admin. */}
            <a
              href={process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3002'}
              className="text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              Panel de gestión
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
