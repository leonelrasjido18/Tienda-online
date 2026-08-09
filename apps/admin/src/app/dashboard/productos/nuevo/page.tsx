'use client';

import { Button, Input, Label } from '@tienda/ui';
import { slugify, type ProductDetailDto, type UpsertProductInput } from '@tienda/shared';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function NewProductPage() {
  const api = useApi();
  const router = useRouter();

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => {
      const body: UpsertProductInput = {
        name,
        slug,
        status: 'DRAFT',
        fulfillmentMode: 'IN_STOCK',
        position: 0,
      };
      return api<ProductDetailDto>('/admin/products', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: (product) => router.push(`/dashboard/productos/${product.id}`),
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo crear el producto'),
  });

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-xl font-semibold">Nuevo producto</h1>

      <form
        className="space-y-4 rounded-lg border border-border bg-background p-6"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            required
            placeholder="Camiseta Titular Boca 2025/26"
            value={name}
            onChange={(e) => {
              const value = e.target.value;
              setName(value);
              if (!slugTouched) setSlug(slugify(value));
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Después de crearlo vas a poder cargar talles, precios, stock y fotos.
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creando…' : 'Crear producto'}
        </Button>
      </form>
    </div>
  );
}
