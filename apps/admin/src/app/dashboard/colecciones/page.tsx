'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import { slugify, type UpsertCollectionInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface CollectionRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  position: number;
  productCount: number;
}

interface CollectionDetail {
  id: string;
  name: string;
  productIds: string[];
}

interface ProductRow {
  id: string;
  name: string;
  teamName: string | null;
  leagueName: string | null;
}

const emptyForm: UpsertCollectionInput = { name: '', slug: '', description: null, imageUrl: null, position: 0 };

export default function CollectionsPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: collections, isLoading } = useQuery({
    queryKey: ['admin', 'collections'],
    queryFn: () => api<CollectionRow[]>('/admin/collections'),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertCollectionInput>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [productsFor, setProductsFor] = useState<CollectionRow | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api(`/admin/collections/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
        : api('/admin/collections', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'collections'] });
      setOpen(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/collections/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'collections'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: CollectionRow) {
    setEditingId(c.id);
    setForm({ name: c.name, slug: c.slug, description: c.description, imageUrl: c.imageUrl, position: c.position });
    setSlugTouched(true);
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Colecciones</h1>
          <p className="text-sm text-muted-foreground">Agrupá productos (Ofertas, Novedades, Selecciones…) y definí relacionados.</p>
        </div>
        <Button onClick={openCreate}>Nueva colección</Button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-24">Productos</TableHead>
              <TableHead className="w-56" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {collections?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Todavía no hay colecciones.
                </TableCell>
              </TableRow>
            )}
            {collections?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                <TableCell>{c.productCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setProductsFor(c)}>
                      Productos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar la colección "${c.name}"?`)) deleteMutation.mutate(c.id);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar colección' : 'Nueva colección'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                required
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setForm((f) => ({ ...f, slug: e.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Input
                id="description"
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="imageUrl">Imagen (URL, opcional)</Label>
                <Input
                  id="imageUrl"
                  value={form.imageUrl ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value || null }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Orden</Label>
                <Input
                  id="position"
                  type="number"
                  min={0}
                  value={form.position ?? 0}
                  onChange={(e) => setForm((f) => ({ ...f, position: Number(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {productsFor && (
        <CollectionProductsDialog collection={productsFor} onClose={() => setProductsFor(null)} />
      )}
    </div>
  );
}

function CollectionProductsDialog({ collection, onClose }: { collection: CollectionRow; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  // `edited` arranca en null: mientras no se toque nada, la selección se deriva del
  // fetch (sin sincronizar por efecto, que dispara la regla set-state-in-effect).
  const [edited, setEdited] = useState<Set<string> | null>(null);
  const [search, setSearch] = useState('');

  const { data: detail } = useQuery({
    queryKey: ['admin', 'collections', collection.id, 'detail'],
    queryFn: () => api<CollectionDetail>(`/admin/collections/${collection.id}`),
  });

  const { data: products } = useQuery({
    queryKey: ['admin', 'products', 'picker'],
    queryFn: () => api<{ items: ProductRow[] }>('/admin/products?perPage=200'),
  });

  const selected = edited ?? new Set(detail?.productIds ?? []);

  const saveMutation = useMutation({
    mutationFn: () =>
      api(`/admin/collections/${collection.id}/products`, {
        method: 'PUT',
        body: JSON.stringify({ productIds: Array.from(selected) }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'collections'] });
      onClose();
    },
  });

  const items = (products?.items ?? []).filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEdited(next);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Productos de «{collection.name}»</DialogTitle>
        </DialogHeader>

        <Input placeholder="Buscar producto…" value={search} onChange={(e) => setSearch(e.target.value)} />

        <div className="max-h-80 overflow-y-auto rounded-md border border-border">
          {items.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>}
          {items.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-border p-2.5 last:border-0 hover:bg-muted/50">
              <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="flex-1 text-sm">
                {p.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {[p.leagueName, p.teamName].filter(Boolean).join(' · ')}
                </span>
              </span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground">{selected.size} seleccionados</span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
