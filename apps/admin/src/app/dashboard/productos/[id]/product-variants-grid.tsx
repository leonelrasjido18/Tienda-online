'use client';

import { Button, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tienda/ui';
import { parseArsToCents, type BulkUpdateVariantsInput, type ProductDetailDto, type UpsertVariantInput } from '@tienda/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useRegisterSave } from './product-save-bus';

type VariantDto = ProductDetailDto['variants'][number];
type OptionsDto = ProductDetailDto['options'];

interface VariantRowState {
  id: string;
  sku: string;
  priceText: string;
  quantity: string;
  allowPreorder: boolean;
}

function toRows(variants: VariantDto[]): VariantRowState[] {
  return variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    priceText: (v.priceCents / 100).toString(),
    quantity: v.inventory.quantity.toString(),
    allowPreorder: v.inventory.allowPreorder,
  }));
}

function combinationLabel(variant: VariantDto, options: OptionsDto): string {
  const valueById = new Map(options.flatMap((o) => o.values.map((v) => [v.id, v.value] as const)));
  const labels = variant.optionValueIds.map((id) => valueById.get(id)).filter(Boolean);
  return labels.length > 0 ? labels.join(' / ') : '(sin talle)';
}

export function ProductVariantsGrid({
  productId,
  variants,
  options,
}: {
  productId: string;
  variants: VariantDto[];
  options: OptionsDto;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  // El componente se remonta (vía `key` en el padre) cuando cambia el conjunto de
  // variantes, así que este estado sólo necesita inicializarse una vez por montaje.
  const [rows, setRows] = useState<VariantRowState[]>(() => toRows(variants));
  // Referencia de lo que vino del servidor, para detectar cambios sin guardar.
  const guardado = JSON.stringify(toRows(variants));
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });

  const saveMutation = useMutation({
    mutationFn: () => {
      let payload: BulkUpdateVariantsInput;
      try {
        payload = {
          variants: rows.map((row) => {
            const partial: Partial<UpsertVariantInput> & { id: string } = {
              id: row.id,
              sku: row.sku,
              priceCents: parseArsToCents(row.priceText),
              quantity: Number(row.quantity),
              allowPreorder: row.allowPreorder,
            };
            return partial;
          }),
        };
      } catch {
        setError('Revisá los precios cargados: tienen que ser números.');
        throw new Error('invalid-price');
      }
      return api(`/admin/products/${productId}/variants/bulk`, { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (variantId: string) => api(`/admin/products/${productId}/variants/${variantId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  // "Guardar y volver" de la cabecera: sólo manda la grilla si se tocó algo.
  useRegisterSave(
    'variants',
    async () => {
      await saveMutation.mutateAsync();
    },
    () => rows.length > 0 && JSON.stringify(rows) !== guardado,
  );

  if (variants.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay variantes generadas.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Combinación</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Precio (ARS)</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Por encargo</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((variant) => {
              const row = rows.find((r) => r.id === variant.id);
              if (!row) return null;
              return (
                <TableRow key={variant.id}>
                  <TableCell className="text-muted-foreground">{combinationLabel(variant, options)}</TableCell>
                  <TableCell>
                    <Input
                      value={row.sku}
                      className="h-8 w-40"
                      onChange={(e) =>
                        setRows((rs) => rs.map((r) => (r.id === variant.id ? { ...r, sku: e.target.value } : r)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.priceText}
                      className="h-8 w-28"
                      inputMode="decimal"
                      onChange={(e) =>
                        setRows((rs) => rs.map((r) => (r.id === variant.id ? { ...r, priceText: e.target.value } : r)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      value={row.quantity}
                      className="h-8 w-20"
                      onChange={(e) =>
                        setRows((rs) => rs.map((r) => (r.id === variant.id ? { ...r, quantity: e.target.value } : r)))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={row.allowPreorder}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((r) => (r.id === variant.id ? { ...r, allowPreorder: e.target.checked } : r)),
                        )
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm('¿Eliminar esta variante?')) deleteMutation.mutate(variant.id);
                      }}
                    >
                      Quitar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
        {saveMutation.isPending ? 'Guardando…' : 'Guardar cambios de la grilla'}
      </Button>
    </div>
  );
}
