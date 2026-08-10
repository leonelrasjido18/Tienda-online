'use client';

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tienda/ui';
import { formatCentsAsArs, parseArsToCents, type LeagueDto, type PatchDto, type UpsertPatchInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';

interface PatchFormState {
  name: string;
  imageUrl: string;
  priceText: string;
  leagueIds: string[];
}

const emptyForm: PatchFormState = { name: '', imageUrl: '', priceText: '', leagueIds: [] };

export default function PatchesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: patches, isLoading } = useQuery({
    queryKey: ['admin', 'patches'],
    queryFn: () => api<PatchDto[]>('/admin/patches'),
  });
  const { data: leagues } = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => api<LeagueDto[]>('/admin/leagues'),
  });
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PatchFormState>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => {
      let priceCents: number;
      try {
        priceCents = parseArsToCents(form.priceText);
      } catch {
        throw new Error('invalid-price');
      }
      const body: UpsertPatchInput = {
        name: form.name,
        imageUrl: form.imageUrl,
        priceCents,
        leagueIds: form.leagueIds,
      };
      return editingId
        ? api<PatchDto>(`/admin/patches/${editingId}`, { method: 'PUT', body: JSON.stringify(body) })
        : api<PatchDto>('/admin/patches', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'patches'] });
      setOpen(false);
    },
    onError: (err) => {
      if (err instanceof ApiError) setError(err.message);
      else setError('Revisá el precio: tiene que ser un número.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/patches/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'patches'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }

  function openEdit(patch: PatchDto) {
    setEditingId(patch.id);
    setForm({
      name: patch.name,
      imageUrl: patch.imageUrl,
      priceText: (patch.priceCents / 100).toString(),
      leagueIds: patch.leagueIds,
    });
    setError(null);
    setOpen(true);
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string }>('/admin/patches/upload', { method: 'POST', body: formData });
      setForm((f) => ({ ...f, imageUrl: result.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  }

  function toggleLeague(leagueId: string) {
    setForm((f) => ({
      ...f,
      leagueIds: f.leagueIds.includes(leagueId) ? f.leagueIds.filter((id) => id !== leagueId) : [...f.leagueIds, leagueId],
    }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Parches</h1>
          <p className="text-sm text-muted-foreground">Champions, liga, copa... complementos con costo adicional.</p>
        </div>
        <Button onClick={openCreate}>Nuevo parche</Button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parche</TableHead>
              <TableHead>Ligas</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead className="w-24" />
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
            {patches?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Todavía no hay parches cargados.
                </TableCell>
              </TableRow>
            )}
            {patches?.map((patch) => (
              <TableRow key={patch.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resolveImageUrl(patch.imageUrl)} alt="" className="h-8 w-8 rounded object-contain" />
                    <span>{patch.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {patch.leagueIds.map((id) => leagueById.get(id)?.name).filter(Boolean).join(', ') || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatCentsAsArs(patch.priceCents)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(patch)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar el parche "${patch.name}"?`)) deleteMutation.mutate(patch.id);
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
            <DialogTitle>{editingId ? 'Editar parche' : 'Nuevo parche'}</DialogTitle>
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
                placeholder="Champions League"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Imagen (PNG con transparencia recomendado)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Elegir imagen'}
                </Button>
                {form.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImageUrl(form.imageUrl)} alt="" className="h-10 w-10 rounded object-contain" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Precio (ARS)</Label>
              <Input
                id="price"
                required
                inputMode="decimal"
                value={form.priceText}
                onChange={(e) => setForm((f) => ({ ...f, priceText: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Ligas donde aplica</Label>
              <div className="grid grid-cols-2 gap-2">
                {leagues?.map((league) => (
                  <label key={league.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.leagueIds.includes(league.id)}
                      onChange={() => toggleLeague(league.id)}
                    />
                    {league.name}
                  </label>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending || !form.imageUrl || uploading}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
