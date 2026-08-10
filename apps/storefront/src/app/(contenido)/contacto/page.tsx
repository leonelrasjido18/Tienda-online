import { getStoreSettings } from '@/lib/api-safe';
import { Card, CardContent, buttonVariants } from '@tienda/ui';
import { MessageSquare, Mail, MapPin, Clock, Instagram } from 'lucide-react';

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Contacto y Atención</h1>
        <p className="mt-2 text-base text-muted-foreground">
          Estamos para despejar tus dudas sobre talles, personalización y estado de tus pedidos.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border border-border">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-foreground">Vías de contacto rápido</h2>

            {whatsappUrl && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">WhatsApp directo</p>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-foreground hover:underline">
                    {settings.whatsappPhone}
                  </a>
                </div>
              </div>
            )}

            {settings.contactEmail && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Correo electrónico</p>
                  <a href={`mailto:${settings.contactEmail}`} className="text-sm font-bold text-foreground hover:underline">
                    {settings.contactEmail}
                  </a>
                </div>
              </div>
            )}

            {settings.instagramUser && (
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
                  <Instagram className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Instagram oficial</p>
                  <a href={`https://instagram.com/${settings.instagramUser}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-foreground hover:underline">
                    @{settings.instagramUser}
                  </a>
                </div>
              </div>
            )}

            {whatsappUrl && (
              <div className="pt-2">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ className: 'w-full gap-2 font-bold' })}
                >
                  <MessageSquare className="h-4 w-4" /> Enviar mensaje por WhatsApp
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {settings.pickupAddress && (
          <Card className="border border-border">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Retiro en local</h2>

              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dirección de retiro</p>
                  <p className="text-sm font-bold text-foreground">{settings.pickupAddress}</p>
                </div>
              </div>

              {settings.openingHours && (
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent-foreground">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Horarios de atención</p>
                    <p className="text-sm font-bold text-foreground">{settings.openingHours}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
