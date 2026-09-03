'use client';

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tienda/ui';
import type { ProductDetailDto } from '@tienda/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';

const NONE = 'none';

type ImageDto = ProductDetailDto['images'][number];
type OptionsDto = ProductDetailDto['options'];

export function ProductImagesManager({
  productId,
  images,
  options,
}: {
  productId: string;
  images: ImageDto[];
  options: OptionsDto;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products', productId] });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api(`/admin/products/${productId}/images`, { method: 'POST', body: formData });
    },
    onSuccess: () => {
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen'),
  });

  const updateImageMutation = useMutation({
    mutationFn: ({ imageId, patch }: { imageId: string; patch: Record<string, unknown> }) =>
      api(`/admin/products/${productId}/images/${imageId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }),
    onSuccess: invalidate,
  });

  const reorderMutation = useMutation({
    mutationFn: (imageIds: string[]) =>
      api(`/admin/products/${productId}/images/reorder`, { method: 'PUT', body: JSON.stringify({ imageIds }) }),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => api(`/admin/products/${productId}/images/${imageId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const ids = images.map((i) => i.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderMutation.mutate(ids);
  }

  const allValues = options.flatMap((o) => o.values.map((v) => ({ id: v.id, label: `${o.name}: ${v.value}` })));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadMutation.mutate(file);
            e.target.value = '';
          }}
        />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? 'Subiendo…' : 'Subir foto'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {images.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay fotos cargadas.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((image, index) => (
            <div key={image.id} className="space-y-2 rounded-lg border border-border p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveImageUrl(image.url)} alt={image.alt ?? ''} className="aspect-square w-full rounded object-cover" />

              {allValues.length > 0 && (
                <Select
                  value={image.optionValueId ?? NONE}
                  onValueChange={(value) =>
                    updateImageMutation.mutate({
                      imageId: image.id,
                      patch: { optionValueId: value === NONE ? null : value },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Sin asociar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin asociar</SelectItem>
                    {allValues.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Button
                type="button"
                variant={image.isLongSleeve ? 'default' : 'outline'}
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  updateImageMutation.mutate({ imageId: image.id, patch: { isLongSleeve: !image.isLongSleeve } })
                }
              >
                {image.isLongSleeve ? '✓ Mangas largas' : 'Marcar mangas largas'}
              </Button>

              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={index === images.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    if (confirm('¿Eliminar esta foto?')) deleteMutation.mutate(image.id);
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
