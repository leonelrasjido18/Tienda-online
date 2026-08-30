'use client';

import { Badge, Button, buttonVariants, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tienda/ui';
import { formatCentsAsArs, type ProductStatus } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';

interface AdminProductListItem {
  id: string;
  slug: string;
  name: string;
  status: ProductStatus;
  fulfillmentMode: string;
  brandName: string | null;
  leagueName: string | null;
  teamName: string | null;
  coverImageUrl: string | null;
  variantCount: number;
  totalStock: number;
  stockByVariant: { label: string; quantity: number }[];
  minPriceCents: number | null;
}

interface AdminProductListResponse {
  items: AdminProductListItem[];
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

const STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  ARCHIVED: 'Archivado',
};

export default function ProductsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', q, page],
    queryFn: () =>
      api<AdminProductListResponse>(
        `/admin/products?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page) }).toString()}`,
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/products/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'products'] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : 'No se pudo eliminar el producto'),
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Productos</h1>
          <p className="text-sm text-muted-foreground">Camisetas, pantalones y todo lo que vendés.</p>
        </div>
        <Link href="/dashboard/productos/nuevo" className={buttonVariants()}>
          Nuevo producto
        </Link>
      </div>

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Buscar por nombre…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Liga / Equipo</TableHead>
              <TableHead>Variantes</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Precio desde</TableHead>
              <TableHead className="w-40 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Todavía no hay productos cargados.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Link href={`/dashboard/productos/${product.id}`} className="flex items-center gap-3 hover:underline">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-xs text-muted-foreground">
                      {product.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveImageUrl(product.coverImageUrl)} alt="" className="h-full w-full object-cover" />
                      ) : (
                        'Sin foto'
                      )}
                    </span>
                    <span className="font-medium">{product.name}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={product.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {STATUS_LABELS[product.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[product.leagueName, product.teamName].filter(Boolean).join(' · ') || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{product.variantCount}</TableCell>
                <TableCell>
                  {product.stockByVariant.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {product.stockByVariant.map((v, i) => (
                        <span
                          key={i}
                          className={
                            'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs ' +
                            (v.quantity > 0
                              ? 'border-border text-foreground'
                              : 'border-destructive/40 text-destructive')
                          }
                          title={`${v.label}: ${v.quantity} en stock`}
                        >
                          <span className="font-medium">{v.label}</span>
                          <span>{v.quantity}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.minPriceCents !== null ? formatCentsAsArs(product.minPriceCents) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Link href={`/dashboard/productos/${product.id}`} className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
                      Editar
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={deleteMutation.isPending}
                      onClick={() => {
                        if (confirm(`¿Eliminar el producto "${product.name}"? Esta acción no se puede deshacer.`)) {
                          deleteMutation.mutate(product.id);
                        }
                      }}
                    >
                      Eliminar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {data.total} producto(s){data.totalPages > 1 ? ` · Página ${data.page} de ${data.totalPages}` : ''}
          </p>
          {data.totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
