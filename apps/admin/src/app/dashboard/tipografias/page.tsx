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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import type { LeagueDto, LeagueFontDto, UpsertLeagueFontInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

function emptyForm(defaultLeagueId: string): UpsertLeagueFontInput {
  return {
    leagueId: defaultLeagueId,
    name: '',
    fontFileUrl: '',
    fillColor: '#FFFFFF',
    strokeColor: null,
    strokeWidthPx: 0,
    letterSpacingPx: 0,
  };
}

export default function FontsPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: fonts, isLoading } = useQuery({
    queryKey: ['admin', 'fonts'],
    queryFn: () => api<LeagueFontDto[]>('/admin/fonts'),
  });
  const { data: leagues } = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => api<LeagueDto[]>('/admin/leagues'),
  });
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertLeagueFontInput>(emptyForm(''));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enableStroke, setEnableStroke] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api<LeagueFontDto>(`/admin/fonts/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
        : api<LeagueFontDto>('/admin/fonts', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'fonts'] });
      setOpen(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/fonts/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'fonts'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(leagues?.[0]?.id ?? ''));
    setEnableStroke(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(font: LeagueFontDto) {
    setEditingId(font.id);
    setForm({
      leagueId: font.leagueId,
      name: font.name,
      fontFileUrl: font.fontFileUrl,
      fillColor: font.fillColor,
      strokeColor: font.strokeColor,
      strokeWidthPx: font.strokeWidthPx,
      letterSpacingPx: font.letterSpacingPx,
    });
    setEnableStroke(!!font.strokeColor);
    setError(null);
    setOpen(true);
  }

  async function handleFileSelected(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api<{ url: string }>('/admin/fonts/upload', { method: 'POST', body: formData });
      setForm((f) => ({ ...f, fontFileUrl: result.url }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el archivo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Tipografías</h1>
          <p className="text-sm text-muted-foreground">Una tipografía por liga, usada para nombre y dorsal.</p>
        </div>
        <Button onClick={openCreate} disabled={!leagues?.length}>
          Nueva tipografía
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead>Color</TableHead>
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
            {fonts?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Todavía no hay tipografías cargadas.
                </TableCell>
              </TableRow>
            )}
            {fonts?.map((font) => (
              <TableRow key={font.id}>
                <TableCell>{font.name}</TableCell>
                <TableCell className="text-muted-foreground">{leagueById.get(font.leagueId)?.name ?? '—'}</TableCell>
                <TableCell>
                  <span
                    className="inline-block h-5 w-5 rounded-full border border-border align-middle"
                    style={{ backgroundColor: font.fillColor }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(font)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar la tipografía "${font.name}"?`)) deleteMutation.mutate(font.id);
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
            <DialogTitle>{editingId ? 'Editar tipografía' : 'Nueva tipografía'}</DialogTitle>
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
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Liga</Label>
              <Select value={form.leagueId} onValueChange={(leagueId) => setForm((f) => ({ ...f, leagueId }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegí una liga" />
                </SelectTrigger>
                <SelectContent>
                  {leagues?.map((league) => (
                    <SelectItem key={league.id} value={league.id}>
                      {league.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Archivo (WOFF2, WOFF, TTF u OTF)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".woff2,.woff,.ttf,.otf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelected(file);
                  e.target.value = '';
                }}
              />
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Subiendo…' : 'Elegir archivo'}
                </Button>
                {form.fontFileUrl && <span className="text-xs text-muted-foreground">Archivo cargado ✓</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fillColor">Color del relleno</Label>
                <Input
                  id="fillColor"
                  type="color"
                  className="h-10 w-full"
                  value={form.fillColor}
                  onChange={(e) => setForm((f) => ({ ...f, fillColor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="letterSpacingPx">Espaciado entre letras (px)</Label>
                <Input
                  id="letterSpacingPx"
                  type="number"
                  value={form.letterSpacingPx}
                  onChange={(e) => setForm((f) => ({ ...f, letterSpacingPx: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={enableStroke}
                  onChange={(e) => {
                    setEnableStroke(e.target.checked);
                    if (!e.target.checked) setForm((f) => ({ ...f, strokeColor: null, strokeWidthPx: 0 }));
                  }}
                />
                Agregar contorno
              </label>
              {enableStroke && (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="strokeColor">Color del contorno</Label>
                    <Input
                      id="strokeColor"
                      type="color"
                      className="h-10 w-full"
                      value={form.strokeColor ?? '#000000'}
                      onChange={(e) => setForm((f) => ({ ...f, strokeColor: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="strokeWidthPx">Grosor (px)</Label>
                    <Input
                      id="strokeWidthPx"
                      type="number"
                      min={1}
                      value={form.strokeWidthPx}
                      onChange={(e) => setForm((f) => ({ ...f, strokeWidthPx: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending || !form.fontFileUrl || uploading}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
