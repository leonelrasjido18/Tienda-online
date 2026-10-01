'use client';

import type { ProductDetailDto } from '@tienda/shared';
import { Check, Heart, Share2 } from 'lucide-react';
import { useState } from 'react';

import { useFavoritos } from '@/lib/favoritos-context';
import { resolveImageUrl } from '@/lib/media';

/**
 * Guardar en favoritos y compartir. Van juntos porque son las dos acciones que
 * se hacen cuando todavía no se decidió comprar.
 */
export function AccionesProducto({ product }: { product: ProductDetailDto }) {
  const { esFavorito, alternar, listo } = useFavoritos();
  const [copiado, setCopiado] = useState(false);

  const guardado = listo && esFavorito(product.slug);
  const precio = product.variants[0]?.priceCents ?? null;

  const url =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://remerasdelarea.com/productos/${product.slug}`;

  const mensaje = `Mirá esta camiseta: ${product.name}\n${url}`;
  const linkWhatsapp = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Algunos navegadores lo bloquean; el enlace de WhatsApp sigue sirviendo.
    }
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() =>
          alternar({
            slug: product.slug,
            name: product.name,
            imageUrl: product.images[0] ? resolveImageUrl(product.images[0].url) : null,
            priceCents: precio,
          })
        }
        aria-pressed={guardado}
        className={
          'inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ' +
          (guardado
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-input bg-background text-foreground hover:bg-secondary')
        }
      >
        <Heart className={'h-4 w-4 ' + (guardado ? 'fill-current' : '')} />
        {guardado ? 'Guardada' : 'Guardar'}
      </button>

      <a
        href={linkWhatsapp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Share2 className="h-4 w-4" />
        Compartir
      </a>

      <button
        type="button"
        onClick={() => void copiarEnlace()}
        className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        {copiado ? <Check className="h-4 w-4 text-accent" /> : null}
        {copiado ? 'Enlace copiado' : 'Copiar enlace'}
      </button>
    </div>
  );
}
