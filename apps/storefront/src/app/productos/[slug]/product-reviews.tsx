'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { Button, Input, Label } from '@tienda/ui';
import type { ReviewSummaryDto } from '@tienda/shared';

import { clientFetch } from '@/lib/client-api';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          width={size}
          height={size}
          className={i <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}
        />
      ))}
    </span>
  );
}

export function ProductReviews({ productId, initial }: { productId: string; initial: ReviewSummaryDto }) {
  // Las reseñas se publican recién cuando se aprueban en el panel, así que enviar
  // una no cambia este resumen: no necesita estado.
  const summary = initial;
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 3) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      await clientFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({ productId, rating, title: title || undefined, body }),
      });
      setMessage({ type: 'ok', text: '¡Gracias! Tu reseña quedó pendiente de aprobación.' });
      setShowForm(false);
      setTitle('');
      setBody('');
    } catch (err) {
      const text =
        err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401
          ? 'Iniciá sesión para dejar tu reseña.'
          : err instanceof Error
            ? err.message
            : 'No pudimos guardar tu reseña.';
      setMessage({ type: 'error', text });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Reseñas</h2>
        <Button variant="outline" size="sm" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancelar' : 'Escribir una reseña'}
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <Stars value={summary.average} size={18} />
        <span className="text-sm text-muted-foreground">
          {summary.count > 0 ? `${summary.average} · ${summary.count} reseña${summary.count === 1 ? '' : 's'}` : 'Sin reseñas todavía'}
        </span>
      </div>

      {message && (
        <p className={`mt-3 text-sm ${message.type === 'ok' ? 'text-emerald-600' : 'text-destructive'}`}>{message.text}</p>
      )}

      {showForm && (
        <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="space-y-1">
            <Label>Puntaje</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button key={i} type="button" onClick={() => setRating(i)} aria-label={`${i} estrellas`}>
                  <Star
                    className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}
                    width={24}
                    height={24}
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-title">Título (opcional)</Label>
            <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="review-body">Tu opinión</Label>
            <textarea
              id="review-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              minLength={3}
              maxLength={2000}
              rows={4}
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
            />
          </div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Publicar reseña'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Sólo pueden reseñar quienes compraron el producto. La reseña se publica tras ser aprobada.
          </p>
        </form>
      )}

      <div className="mt-6 space-y-4">
        {summary.reviews.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">Sé el primero en dejar tu opinión.</p>
        )}
        {summary.reviews.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <Stars value={r.rating} />
              <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('es-AR')}</span>
            </div>
            {r.title && <p className="mt-2 font-semibold text-foreground">{r.title}</p>}
            <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
            <p className="mt-2 text-xs font-medium text-foreground">{r.authorName} · Compra verificada</p>
          </div>
        ))}
      </div>
    </section>
  );
}
