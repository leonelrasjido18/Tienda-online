import { getStoreSettings } from '@/lib/api-safe';
import { buttonVariants } from '@tienda/ui';
import { MessageSquare, Mail, MapPin, Clock, Instagram } from 'lucide-react';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Atención al Cliente y Contacto',
  description: 'Comunicate con nosotros por WhatsApp, correo o redes sociales para cualquier consulta.',
};

export default async function ContactoPage() {
  const settings = await getStoreSettings();

  const whatsappUrl = settings.whatsappPhone
    ? `https://wa.me/${settings.whatsappPhone.replace(/\D/g, '')}${settings.whatsappMessage ? `?text=${encodeURIComponent(settings.whatsappMessage)}` : ''}`
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="border-b border-border pb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Atención al cliente</p>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Contacto y atención</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
          Estamos para despejar tus dudas sobre talles, personalización y el estado de tus pedidos. Te respondemos
          lo antes posible.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="flex flex-col rounded-xl border border-border bg-card p-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Vías de contacto</h2>

          <ul className="mt-5 divide-y divide-border">
            {whatsappUrl && (
              <ContactRow icon={<MessageSquare className="h-4 w-4" />} label="WhatsApp" value={settings.whatsappPhone!} href={whatsappUrl} external />
            )}
            {settings.contactEmail && (
              <ContactRow icon={<Mail className="h-4 w-4" />} label="Correo electrónico" value={settings.contactEmail} href={`mailto:${settings.contactEmail}`} />
            )}
            {settings.instagramUser && (
              <ContactRow
                icon={<Instagram className="h-4 w-4" />}
                label="Instagram"
                value={`@${settings.instagramUser}`}
                href={`https://instagram.com/${settings.instagramUser}`}
                external
              />
            )}
          </ul>

          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ className: 'mt-6 w-full gap-2 font-semibold' })}
            >
              <MessageSquare className="h-4 w-4" /> Escribinos por WhatsApp
            </a>
          )}
        </section>

        {settings.pickupAddress && (
          <section className="rounded-xl border border-border bg-card p-6">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Retiro en local</h2>

            <ul className="mt-5 divide-y divide-border">
              <ContactRow icon={<MapPin className="h-4 w-4" />} label="Dirección" value={settings.pickupAddress} />
              {settings.openingHours && (
                <ContactRow icon={<Clock className="h-4 w-4" />} label="Horarios" value={settings.openingHours} />
              )}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  const content = (
    <div className="flex items-center gap-4 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );

  if (!href) return <li>{content}</li>;

  return (
    <li>
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        className="-mx-2 block rounded-lg px-2 transition-colors hover:bg-secondary"
      >
        {content}
      </a>
    </li>
  );
}
