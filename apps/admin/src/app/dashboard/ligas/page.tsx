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
import { slugify, type LeagueDto, type UpsertLeagueInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';

const emptyForm: UpsertLeagueInput = { name: '', slug: '', logoUrl: null, position: 0 };

export default function LeaguesPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: leagues, isLoading } = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => api<LeagueDto[]>('/admin/leagues'),
  });

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertLeagueInput>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { url } = await api<{ url: string }>('/admin/leagues/logo', { method: 'POST', body: fd });
      setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el logo');
    } finally {
      setUploadingLogo(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api<LeagueDto>(`/admin/leagues/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
        : api<LeagueDto>('/admin/leagues', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'leagues'] });
      setOpen(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/leagues/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'leagues'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(league: LeagueDto) {
    setEditingId(league.id);
    setForm({ name: league.name, slug: league.slug, logoUrl: league.logoUrl, position: league.position });
    setSlugTouched(true);
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Ligas</h1>
          <p className="text-sm text-muted-foreground">Premier League, LaLiga, Selecciones...</p>
        </div>
        <Button onClick={openCreate}>Nueva liga</Button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {leagues?.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Todavía no hay ligas cargadas.
                </TableCell>
              </TableRow>
            )}
            {leagues?.map((league) => (
              <TableRow key={league.id}>
                <TableCell>{league.name}</TableCell>
                <TableCell className="text-muted-foreground">{league.slug}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(league)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar la liga "${league.name}"?`)) {
                          deleteMutation.mutate(league.id);
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar liga' : 'Nueva liga'}</DialogTitle>
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
              <Label htmlFor="logoFile">Logo (opcional)</Label>
              <div className="flex items-center gap-3">
                {form.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImageUrl(form.logoUrl)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded border border-border bg-muted object-contain p-1"
                  />
                )}
                <div className="flex-1 space-y-1">
                  <Input
                    id="logoFile"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    disabled={uploadingLogo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleLogoUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {uploadingLogo ? 'Subiendo…' : 'PNG, JPG o SVG (máx. 5 MB). Se guarda optimizado.'}
                  </p>
                </div>
                {form.logoUrl && !uploadingLogo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, logoUrl: null }))}
                  >
                    Quitar
                  </Button>
                )}
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
    </div>
  );
}
