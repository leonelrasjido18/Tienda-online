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
import { slugify, type LeagueDto, type TeamDto, type UpsertTeamInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

function emptyForm(defaultLeagueId: string): UpsertTeamInput {
  return { name: '', slug: '', leagueId: defaultLeagueId, crestUrl: null, position: 0 };
}

export default function TeamsPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: teams, isLoading } = useQuery({
    queryKey: ['admin', 'teams'],
    queryFn: () => api<TeamDto[]>('/admin/teams'),
  });
  const { data: leagues } = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => api<LeagueDto[]>('/admin/leagues'),
  });
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertTeamInput>(emptyForm(''));
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api<TeamDto>(`/admin/teams/${editingId}`, { method: 'PUT', body: JSON.stringify(form) })
        : api<TeamDto>('/admin/teams', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] });
      setOpen(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/teams/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'teams'] }),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(leagues?.[0]?.id ?? ''));
    setSlugTouched(false);
    setError(null);
    setOpen(true);
  }

  function openEdit(team: TeamDto) {
    setEditingId(team.id);
    setForm({ name: team.name, slug: team.slug, leagueId: team.leagueId, crestUrl: team.crestUrl, position: team.position });
    setSlugTouched(true);
    setError(null);
    setOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Equipos</h1>
          <p className="text-sm text-muted-foreground">Clubes y selecciones, agrupados por liga.</p>
        </div>
        <Button onClick={openCreate} disabled={!leagues?.length}>
          Nuevo equipo
        </Button>
      </div>

      {!leagues?.length && !isLoading && (
        <p className="mb-4 text-sm text-muted-foreground">
          Primero cargá al menos una liga en la sección &ldquo;Ligas&rdquo;.
        </p>
      )}

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Liga</TableHead>
              <TableHead>Slug</TableHead>
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
            {teams?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Todavía no hay equipos cargados.
                </TableCell>
              </TableRow>
            )}
            {teams?.map((team) => (
              <TableRow key={team.id}>
                <TableCell>{team.name}</TableCell>
                <TableCell className="text-muted-foreground">{leagueById.get(team.leagueId)?.name ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{team.slug}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(team)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => {
                        if (confirm(`¿Eliminar el equipo "${team.name}"?`)) {
                          deleteMutation.mutate(team.id);
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
            <DialogTitle>{editingId ? 'Editar equipo' : 'Nuevo equipo'}</DialogTitle>
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
              <Label htmlFor="crestUrl">Escudo (URL, opcional)</Label>
              <Input
                id="crestUrl"
                value={form.crestUrl ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, crestUrl: e.target.value || null }))}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="submit" disabled={saveMutation.isPending || !form.leagueId}>
                {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
