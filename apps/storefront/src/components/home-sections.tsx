import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, Truck, Sparkles, RefreshCw, MessageSquare, ArrowRight } from 'lucide-react';
import type { Paginated, ProductListItemDto, ProductFacetsDto } from '@tienda/shared';
import { buttonVariants, Card, CardContent } from '@tienda/ui';

import { apiFetchSafe, getPaymentDiscounts, getStoreSettings } from '@/lib/api-safe';
import { ProductCard } from '@/components/product-card';
import { LeagueCarousel } from '@/components/league-carousel';

// --- 1. HERO SECTION ---
export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-card text-card-foreground">
      <div className="mx-auto flex max-w-[1600px] flex-col-reverse items-center justify-between gap-8 px-4 py-12 md:flex-row md:py-20">
        <div className="z-10 max-w-xl text-center md:text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Nueva Temporada 2026
          </span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Camisetas de Fútbol <br className="hidden sm:inline" />
            <span className="text-accent">Oficiales y por Encargo</span>
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Elegí camisetas de tus clubes y selecciones favoritas. Personalizá nombre, dorsal y parches oficiales con vista previa en vivo.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
            <Link href="/productos" className={buttonVariants({ size: 'lg', className: 'gap-2 font-semibold' })}>
              Ver Catálogo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/como-funciona" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              ¿Cómo funciona la seña?
            </Link>
          </div>
        </div>

        <div className="relative aspect-[16/10] w-full max-w-lg overflow-hidden rounded-2xl border border-border shadow-2xl">
          <Image
            src="/hero.jpg"
            alt="Camisetas de fútbol de colección"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 500px"
            className="object-cover transition-transform duration-500 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 rounded-lg border border-white/10 bg-black/40 p-3 backdrop-blur-md text-white">
            <p className="text-xs font-semibold">Personalización en Alta Definición</p>
            <p className="text-[11px] text-white/80">Estampado oficial con tipografía real de cada liga</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 2. TRUST BAR ---
export function TrustBar() {
  const items = [
    {
      icon: RefreshCw,
      title: 'Entrega Inmediata o Encargo',
      desc: 'Stock local disponible y encargos a China con seña del 50%.',
    },
    {
      icon: Sparkles,
      title: 'Personalización Oficial',
      desc: 'Elegí nombre, número y parches con tipografías reales de liga.',
    },
    {
      icon: Truck,
      title: 'Envíos a todo el País',
      desc: 'Recibilo en tu domicilio o retiralo por nuestro local.',
    },
    {
      icon: ShieldCheck,
      title: 'Compra Segura',
      desc: 'Pagá con Mercado Pago o Transferencia Bancaria.',
    },
  ];

  return (
    <section className="border-y border-border bg-muted/40 py-8">
      <div className="mx-auto max-w-[1600px] px-4">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-sm border border-border text-foreground">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// --- 3. PRODUCT RAIL (Server Async) ---
export async function ProductRail({
  title,
  subtitle,
  qs,
  viewAllHref,
}: {
  title: string;
  subtitle?: string;
  qs: string;
  viewAllHref?: string;
}) {
  // Sin caché: son camisetas, y una ya borrada no puede seguir saliendo en la portada.
  const [data, descuentos] = await Promise.all([
    apiFetchSafe<Paginated<ProductListItemDto>>(`/catalog/products?${qs}`, { cache: 'no-store' }),
    getPaymentDiscounts(),
  ]);
  const items = data?.items ?? [];

  if (items.length === 0) return null;

  return (
    <section className="py-12">
      <div className="mx-auto max-w-[1600px] px-4">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-sm font-semibold text-accent hover:underline flex items-center gap-1"
            >
              Ver todos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none">
          {items.map((product) => (
            <div key={product.id} className="w-[200px] sm:w-[230px] shrink-0 snap-start">
              <ProductCard product={product} descuentos={descuentos} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- 4. LEAGUE GRID (Server Async) ---
export async function LeagueGrid() {
  const [facets, leagues] = await Promise.all([
    apiFetchSafe<ProductFacetsDto>('/catalog/facets'),
    apiFetchSafe<{ slug: string; name: string; logoUrl: string | null }[]>('/catalog/leagues'),
  ]);

  const facetLeagues = facets?.leagues ?? [];
  if (facetLeagues.length === 0) return null;

  // Se cruza el conteo (facetas) con el logo (catálogo de ligas) por slug.
  const logoBySlug = new Map((leagues ?? []).map((l) => [l.slug, l.logoUrl]));
  const items = facetLeagues.map((l) => ({
    slug: l.value,
    name: l.label,
    count: l.count,
    logoUrl: logoBySlug.get(l.value) ?? null,
  }));

  return (
    <section className="bg-card py-12 border-y border-border">
      <div className="mx-auto max-w-[1600px] px-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Comprá por Liga</h2>
        <p className="mt-1 text-sm text-muted-foreground">Explorá el catálogo por las principales ligas del mundo.</p>
      </div>
      <div className="mt-6">
        <LeagueCarousel items={items} />
      </div>
    </section>
  );
}

// --- 5. HOW IT WORKS ---
export function HowItWorks() {
  const steps = [
    {
      num: '1',
      title: 'Elegí tu camiseta y personalizala',
      desc: 'Seleccioná el talle, versión (Fan o Jugador) y agregá tu nombre, dorsal preferido y parches de liga.',
    },
    {
      num: '2',
      title: 'Confirmá con el 50% de seña',
      desc: 'Si la variante es por encargo a China, pagás el 50% al momento del pedido y congelás el precio.',
    },
    {
      num: '3',
      title: 'Aviso y pago del saldo al llegar',
      desc: 'Te avisamos apenas llegue el paquete (aprox 20 días). Abonás el saldo restante + envío y lo despachamos.',
    },
  ];

  return (
    <section className="py-16 bg-muted/20">
      <div className="mx-auto max-w-[1600px] px-4">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">¿Cómo funciona la compra por encargo?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Traemos tu camiseta directamente desde la fábrica en China con el sistema de pre-venta asegurada.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.num} className="relative overflow-hidden">
              <CardContent className="p-6">
                <span className="absolute -right-3 -top-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-3xl font-black text-accent/40">
                  {step.num}
                </span>
                <div className="mb-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
                  {step.num}
                </div>
                <h3 className="text-base font-bold text-foreground">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/como-funciona" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Leer todas las condiciones de encargo
          </Link>
        </div>
      </div>
    </section>
  );
}

// --- 6. CUSTOMIZATION SHOWCASE ---
export function CustomizationShowcase() {
  return (
    <section className="py-16 border-t border-border bg-card">
      <div className="mx-auto max-w-[1600px] px-4">
        <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent">Vista previa en tiempo real</span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Diseñá tu camiseta tal cual la querés recibir
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Nuestro motor de renderizado genera la vista previa exacta con la tipografía oficial de la liga. Lo que ves en la pantalla es exactamente el diseño vectorizado que se envía al fabricante.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Tipografía original de cada liga (Premier, La Liga, Champions)</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Parches oficiales en mangas (Mundial de Clubes, Liga, LDC)</span>
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Estampado de vinilo de alta durabilidad resistente a lavados</span>
              </li>
            </ul>
            <div className="mt-8">
              <Link href="/productos" className={buttonVariants({ className: 'gap-2' })}>
                Ir a personalizar una camiseta <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background p-6 shadow-xl">
            <div className="aspect-[4/3] rounded-lg bg-muted flex items-center justify-center relative overflow-hidden">
              <div className="text-center p-6">
                <div className="inline-block rounded border border-border bg-card px-4 py-2 text-3xl font-black tracking-widest text-foreground shadow-sm">
                  MESSI <span className="text-accent">10</span>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Previsualización interactiva directamente en la ficha del producto</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// --- 7. FAQ SECTION (Native accordion) ---
export function FaqSection() {
  const faqs = [
    {
      q: '¿Cuánto demora un pedido por encargo?',
      a: 'El plazo de entrega estimado para pedidos traídos desde China es de 15 a 25 días hábiles desde que se confirma la seña.',
    },
    {
      q: '¿Qué diferencia hay entre versión Fan y Versión Jugador?',
      a: 'La versión Fan tiene un calce holgado tradicional y escudos bordados. La versión Jugador es entallada al cuerpo, ultra liviana y posee escudos estampados en termosellado.',
    },
    {
      q: '¿Se pueden personalizar todas las camisetas?',
      a: 'Sí, la mayoría de nuestras camisetas permiten agregar nombre, dorsal y parches oficiales.',
    },
    {
      q: '¿Qué medios de pago aceptan?',
      a: 'Aceptamos Mercado Pago (tarjetas de crédito, débito, saldo MP) y Transferencia Bancaria con descuento especial.',
    },
  ];

  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="mx-auto max-w-3xl px-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Preguntas Frecuentes</h2>
          <p className="mt-1 text-sm text-muted-foreground">Respuestas rápidas a las dudas más comunes de nuestros clientes.</p>
        </div>

        <div className="mt-8 space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              name="faq"
              className="group rounded-lg border border-border bg-card p-4 transition-colors [&[open]]:bg-muted/30"
            >
              <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground list-none select-none">
                <span>{faq.q}</span>
                <span className="ml-2 text-muted-foreground transition-transform group-open:rotate-180">↓</span>
              </summary>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Link href="/preguntas-frecuentes" className="text-sm font-semibold text-accent hover:underline">
            Ver todas las preguntas frecuentes →
          </Link>
        </div>
      </div>
    </section>
  );
}

// --- 8. CONTACT CTA ---
export async function ContactCta() {
  const settings = await getStoreSettings();

  const whatsappUrl = settings.whatsappPhone
    ? `https://wa.me/${settings.whatsappPhone.replace(/\D/g, '')}${settings.whatsappMessage ? `?text=${encodeURIComponent(settings.whatsappMessage)}` : ''}`
    : null;

  return (
    <section className="border-t border-border bg-primary text-primary-foreground py-12">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">¿Tenés alguna consulta antes de comprar?</h2>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Escribinos por WhatsApp o mail y te ayudamos a elegir el talle o armar tu pedido personalizado.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-4">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'default', size: 'lg', className: 'bg-accent text-accent-foreground hover:bg-accent/90 gap-2 font-bold' })}
            >
              <MessageSquare className="h-5 w-5" /> Hablar por WhatsApp
            </a>
          )}
          <Link
            href="/contacto"
            className={buttonVariants({ variant: 'outline', size: 'lg', className: 'bg-transparent text-primary-foreground border-primary-foreground/30 hover:bg-primary-foreground/10' })}
          >
            Formulario de contacto
          </Link>
        </div>
      </div>
    </section>
  );
}
