'use client';

import { Badge, buttonVariants, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tienda/ui';
import { formatCentsAsArs, type ProductStatus } from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

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
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'products', q],
    queryFn: () =>
      api<AdminProductListResponse>(`/admin/products?${new URLSearchParams(q ? { q } : {}).toString()}`),
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
        <Input placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
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
                <TableCell className="text-muted-foreground">{product.totalStock}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.minPriceCents !== null ? formatCentsAsArs(product.minPriceCents) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
