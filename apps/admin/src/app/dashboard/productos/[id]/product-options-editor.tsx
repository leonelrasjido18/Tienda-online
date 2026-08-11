'use client';

import { Button, Input, Label } from '@tienda/ui';
import type { ProductDetailDto, ReplaceProductOptionsInput } from '@tienda/shared';
import { MAX_PRODUCT_OPTIONS } from '@tienda/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface OptionDraft {
  name: string;
  valuesText: string;
}

/** Talles por defecto para un producto nuevo (se pueden editar antes de guardar). */
const DEFAULT_SIZES = 'S, M, L, XL, XXL';

function toDrafts(options: ProductDetailDto['options']): OptionDraft[] {
  if (options.length === 0) {
    return [{ name: 'Talle', valuesText: DEFAULT_SIZES }];
  }
  return options.map((o) => ({ name: o.name, valuesText: o.values.map((v) => v.value).join(', ') }));
}

export function ProductOptionsEditor({
  productId,
  options,
}: {
  productId: string;
  options: ProductDetailDto['options'];
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<OptionDraft[]>(toDrafts(options));
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });
  };

  const saveOptionsMutation = useMutation({
    mutationFn: () => {
      const payload: ReplaceProductOptionsInput = {
        options: drafts
          .filter((d) => d.name.trim())
          .map((d, position) => ({
            name: d.name.trim(),
            position,
            values: d.valuesText
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean)
              .map((value, valuePosition) => ({ value, position: valuePosition })),
          }))
          .filter((o) => o.values.length > 0),
      };
      return api(`/admin/products/${productId}/options`, { method: 'PUT', body: JSON.stringify(payload) });
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudieron guardar las opciones'),
  });

  const generateMutation = useMutation({
    mutationFn: () => api(`/admin/products/${productId}/variants/generate`, { method: 'POST' }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudieron generar las variantes'),
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Definí las opciones del producto (por ejemplo Talle y Versión) separando los valores con comas. Después
        tocá &ldquo;Generar variantes&rdquo; para crear automáticamente todas las combinaciones.
      </p>

      <div className="space-y-3">
        {drafts.map((draft, index) => (
          <div key={index} className="grid grid-cols-[160px_1fr_auto] items-end gap-3">
            <div className="space-y-2">
              <Label>Opción</Label>
              <Input
                placeholder="Talle"
                value={draft.name}
                onChange={(e) =>
                  setDrafts((ds) => ds.map((d, i) => (i === index ? { ...d, name: e.target.value } : d)))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Valores (separados por coma)</Label>
              <Input
                placeholder={DEFAULT_SIZES}
                value={draft.valuesText}
                onChange={(e) =>
                  setDrafts((ds) => ds.map((d, i) => (i === index ? { ...d, valuesText: e.target.value } : d)))
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => setDrafts((ds) => ds.filter((_, i) => i !== index))}
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={drafts.length >= MAX_PRODUCT_OPTIONS}
          onClick={() => setDrafts((ds) => [...ds, { name: '', valuesText: '' }])}
        >
          + Agregar opción
        </Button>
        <Button type="button" size="sm" disabled={saveOptionsMutation.isPending} onClick={() => saveOptionsMutation.mutate()}>
          {saveOptionsMutation.isPending ? 'Guardando…' : 'Guardar opciones'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={generateMutation.isPending || options.length === 0}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? 'Generando…' : 'Generar variantes'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
