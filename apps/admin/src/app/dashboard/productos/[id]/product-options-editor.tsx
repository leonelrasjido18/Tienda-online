'use client';

import { Button, Input, Label } from '@tienda/ui';
import type { ProductDetailDto, QuickVariantSetupInput, ReplaceProductOptionsInput } from '@tienda/shared';
import { MAX_PRODUCT_OPTIONS, parseArsToCents } from '@tienda/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useRegisterSave } from './product-save-bus';

interface OptionDraft {
  name: string;
  valuesText: string;
}

/** Talles por defecto para un producto nuevo (se pueden editar antes de guardar). */
const DEFAULT_SIZES = 'S, M, L, XL, XXL';

// Precios de referencia del catalogo actual. Son sugerencias editables, no un
// tope: la grilla sigue permitiendo cualquier valor por variante.
const PRECIO_SUGERIDO = '42000';
const PRECIO_SUGERIDO_MANGA_LARGA = '46000';

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

  // Referencia de las opciones guardadas. Es clave que "Guardar y volver" NO
  // reemplace opciones que nadie tocó: reemplazarlas regenera variantes y
  // vuelve a atar las fotos, trabajo destructivo por nada.
  const guardado = JSON.stringify(toDrafts(options));

  const [quickSizes, setQuickSizes] = useState(DEFAULT_SIZES);
  const [quickPrice, setQuickPrice] = useState(PRECIO_SUGERIDO);
  const [withLongSleeve, setWithLongSleeve] = useState(false);
  const [quickLongPrice, setQuickLongPrice] = useState(PRECIO_SUGERIDO_MANGA_LARGA);

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

  const quickMutation = useMutation({
    mutationFn: () => {
      const payload: QuickVariantSetupInput = {
        sizes: quickSizes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        withLongSleeve,
        priceCents: parseArsToCents(quickPrice),
        longSleevePriceCents: withLongSleeve ? parseArsToCents(quickLongPrice) : null,
        quantity: 0,
        trackInventory: true,
        allowPreorder: true,
      };
      return api(`/admin/products/${productId}/variants/quick-setup`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo generar la carga rápida'),
  });

  // "Guardar y volver" de la cabecera.
  useRegisterSave(
    'options',
    async () => {
      await saveOptionsMutation.mutateAsync();
    },
    () => JSON.stringify(drafts) !== guardado,
  );

  const precioValido = (texto: string) => {
    try {
      return parseArsToCents(texto) > 0;
    } catch {
      return false;
    }
  };
  const quickListo =
    quickSizes.trim().length > 0 && precioValido(quickPrice) && (!withLongSleeve || precioValido(quickLongPrice));

  return (
    <div className="space-y-4">
      {/* Carga rápida: cubre el caso habitual (talles, y manga si el modelo la
          tiene) sin pasar por guardar opciones → generar → completar la grilla. */}
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Carga rápida</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="quick-sizes">Talles</Label>
            <Input
              id="quick-sizes"
              value={quickSizes}
              onChange={(e) => setQuickSizes(e.target.value)}
              placeholder={DEFAULT_SIZES}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-price">Precio manga corta (ARS)</Label>
            <Input
              id="quick-price"
              inputMode="decimal"
              value={quickPrice}
              onChange={(e) => setQuickPrice(e.target.value)}
              placeholder="42000"
            />
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={withLongSleeve}
            onChange={(e) => setWithLongSleeve(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span>Este modelo también viene en manga larga</span>
        </label>

        {withLongSleeve && (
          <div className="mt-3 max-w-xs space-y-2">
            <Label htmlFor="quick-long-price">Precio manga larga (ARS)</Label>
            <Input
              id="quick-long-price"
              inputMode="decimal"
              value={quickLongPrice}
              onChange={(e) => setQuickLongPrice(e.target.value)}
              placeholder="46000"
            />
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {withLongSleeve
            ? `Crea las opciones Talle y Manga (Corta/Larga), genera las ${
                quickSizes.split(',').filter((s) => s.trim()).length * 2
              } combinaciones y les pone precio: las largas más caras.`
            : `Crea la opción Talle, genera las ${
                quickSizes.split(',').filter((s) => s.trim()).length
              } variantes y les pone el precio.`}{' '}
          Quedan por encargo, con stock 0.
        </p>

        {options.length > 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
            Este producto ya tiene opciones cargadas. Al generar se reemplazan, y las variantes cuya combinación
            deje de existir se eliminan con su precio y stock.
          </p>
        )}

        <Button
          type="button"
          size="sm"
          className="mt-3"
          disabled={quickMutation.isPending || !quickListo}
          onClick={() => {
            setError(null);
            quickMutation.mutate();
          }}
        >
          {quickMutation.isPending ? 'Generando…' : 'Generar todo'}
        </Button>
      </div>
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
