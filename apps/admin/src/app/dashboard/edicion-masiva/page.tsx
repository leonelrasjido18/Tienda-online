'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tienda/ui';
import type { BulkEditChanges, BulkEditFilter, BulkEditPreviewDto } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, Pencil } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Opcion {
  id: string;
  name?: string;
  label?: string;
}

/** Valor de los Select cuando no se eligió nada: Radix no admite value="". */
const NINGUNO = 'NINGUNO';

function Lista({
  label,
  valor,
  onChange,
  opciones,
  textoVacio,
}: {
  label: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: Opcion[] | undefined;
  textoVacio: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NINGUNO}>{textoVacio}</SelectItem>
          {opciones?.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name ?? o.label ?? o.id}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function EdicionMasivaPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  // --- filtro: qué productos entran
  const [q, setQ] = useState('');
  const [filtroStatus, setFiltroStatus] = useState(NINGUNO);
  const [filtroLiga, setFiltroLiga] = useState(NINGUNO);
  const [sinLiga, setSinLiga] = useState(false);
  const [sinEquipo, setSinEquipo] = useState(false);
  const [sinFoto, setSinFoto] = useState(false);

  // --- cambios: qué se les hace
  const [nuevoStatus, setNuevoStatus] = useState(NINGUNO);
  const [nuevaLiga, setNuevaLiga] = useState(NINGUNO);
  const [nuevoEquipo, setNuevoEquipo] = useState(NINGUNO);
  const [nuevaCategoria, setNuevaCategoria] = useState(NINGUNO);
  const [nuevaEntrega, setNuevaEntrega] = useState(NINGUNO);

  const [previo, setPrevio] = useState<BulkEditPreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: ligas } = useQuery({ queryKey: ['admin', 'leagues'], queryFn: () => api<Opcion[]>('/admin/leagues') });
  const { data: equipos } = useQuery({ queryKey: ['admin', 'teams'], queryFn: () => api<Opcion[]>('/admin/teams') });
  const { data: categorias } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => api<Opcion[]>('/admin/categories'),
  });

  const limpio = (v: string) => (v === NINGUNO ? null : v);

  function cuerpo(): { filtro: BulkEditFilter; cambios: BulkEditChanges } {
    return {
      filtro: {
        q: q.trim() || null,
        status: limpio(filtroStatus) as BulkEditFilter['status'],
        leagueId: sinLiga ? null : limpio(filtroLiga),
        teamId: null,
        categoryId: null,
        sinLiga,
        sinEquipo,
        sinFoto,
      },
      cambios: {
        status: limpio(nuevoStatus) as BulkEditChanges['status'],
        leagueId: limpio(nuevaLiga),
        teamId: limpio(nuevoEquipo),
        categoryId: limpio(nuevaCategoria),
        seasonId: null,
        fulfillmentMode: limpio(nuevaEntrega) as BulkEditChanges['fulfillmentMode'],
      },
    };
  }

  const hayCambios = [nuevoStatus, nuevaLiga, nuevoEquipo, nuevaCategoria, nuevaEntrega].some(
    (v) => v !== NINGUNO,
  );

  const simular = useMutation({
    mutationFn: () => api<BulkEditPreviewDto>('/admin/bulk-edit/preview', { method: 'POST', body: JSON.stringify(cuerpo()) }),
    onSuccess: (d) => {
      setPrevio(d);
      setError(null);
      setResultado(null);
    },
    onError: (err) => {
      setPrevio(null);
      setError(err instanceof ApiError ? err.message : 'No se pudo simular');
    },
  });

  const aplicar = useMutation({
    mutationFn: () =>
      api<{ actualizados: number }>('/admin/bulk-edit/apply', { method: 'POST', body: JSON.stringify(cuerpo()) }),
    onSuccess: async (d) => {
      setResultado(`Listo: se actualizaron ${d.actualizados} productos.`);
      setPrevio(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo aplicar'),
  });

  const invalidarPrevio = () => setPrevio(null);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Edición masiva</h1>
        <p className="text-sm text-muted-foreground">
          Cambiá liga, equipo, categoría, estado o modalidad de entrega en varios productos a la vez.
        </p>
      </div>

      <section className="space-y-4 rounded-lg border border-border bg-background p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          1 · Qué productos
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="q">Buscar por nombre</Label>
            <Input
              id="q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                invalidarPrevio();
              }}
              placeholder="Boca, Retro, manga larga…"
            />
          </div>
          <Lista
            label="Estado"
            valor={filtroStatus}
            onChange={(v) => {
              setFiltroStatus(v);
              invalidarPrevio();
            }}
            opciones={[
              { id: 'ACTIVE', name: 'Activo' },
              { id: 'DRAFT', name: 'Borrador' },
              { id: 'ARCHIVED', name: 'Archivado' },
            ]}
            textoVacio="Cualquiera"
          />
          <Lista
            label="Liga"
            valor={filtroLiga}
            onChange={(v) => {
              setFiltroLiga(v);
              invalidarPrevio();
            }}
            opciones={ligas}
            textoVacio="Cualquiera"
          />
        </div>

        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            O buscá lo que quedó a medio cargar
          </p>
          {[
            ['Sin liga asignada', sinLiga, setSinLiga] as const,
            ['Sin equipo asignado', sinEquipo, setSinEquipo] as const,
            ['Sin ninguna foto', sinFoto, setSinFoto] as const,
          ].map(([texto, valor, set]) => (
            <label key={texto} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={valor}
                onChange={(e) => {
                  set(e.target.checked);
                  invalidarPrevio();
                }}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {texto}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border bg-background p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          2 · Qué cambiar
        </h2>
        <p className="text-xs text-muted-foreground">
          Lo que dejes en &ldquo;No cambiar&rdquo; se mantiene como está.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Lista
            label="Estado"
            valor={nuevoStatus}
            onChange={(v) => {
              setNuevoStatus(v);
              invalidarPrevio();
            }}
            opciones={[
              { id: 'ACTIVE', name: 'Activo' },
              { id: 'DRAFT', name: 'Borrador' },
              { id: 'ARCHIVED', name: 'Archivado' },
            ]}
            textoVacio="No cambiar"
          />
          <Lista
            label="Liga"
            valor={nuevaLiga}
            onChange={(v) => {
              setNuevaLiga(v);
              invalidarPrevio();
            }}
            opciones={ligas}
            textoVacio="No cambiar"
          />
          <Lista
            label="Equipo"
            valor={nuevoEquipo}
            onChange={(v) => {
              setNuevoEquipo(v);
              invalidarPrevio();
            }}
            opciones={equipos}
            textoVacio="No cambiar"
          />
          <Lista
            label="Categoría"
            valor={nuevaCategoria}
            onChange={(v) => {
              setNuevaCategoria(v);
              invalidarPrevio();
            }}
            opciones={categorias}
            textoVacio="No cambiar"
          />
          <Lista
            label="Modalidad de entrega"
            valor={nuevaEntrega}
            onChange={(v) => {
              setNuevaEntrega(v);
              invalidarPrevio();
            }}
            opciones={[
              { id: 'PREORDER', name: 'Solo por encargo' },
              { id: 'IN_STOCK', name: 'Solo stock inmediato' },
              { id: 'BOTH', name: 'Ambas' },
            ]}
            textoVacio="No cambiar"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {resultado && <p className="text-sm font-medium text-primary">{resultado}</p>}

        <Button onClick={() => simular.mutate()} disabled={simular.isPending || !hayCambios}>
          <Eye className="mr-2 h-4 w-4" />
          {simular.isPending ? 'Simulando…' : 'Simular'}
        </Button>
        {!hayCambios && (
          <p className="text-xs text-muted-foreground">Elegí al menos un cambio para poder simular.</p>
        )}
      </section>

      {previo && (
        <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium">Vas a modificar {previo.afectados} productos</p>
              <p className="text-sm text-muted-foreground">
                No se deshace con un botón: para volver atrás hay que aplicar el cambio inverso.
              </p>
            </div>
          </div>

          {previo.ejemplos.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border bg-background p-3 text-sm">
              {previo.ejemplos.map((e) => (
                <li key={e.id} className="truncate text-muted-foreground">
                  {e.name}
                </li>
              ))}
              {previo.afectados > previo.ejemplos.length && (
                <li className="text-xs text-muted-foreground">
                  …y {previo.afectados - previo.ejemplos.length} más
                </li>
              )}
            </ul>
          )}

          <Button onClick={() => aplicar.mutate()} disabled={aplicar.isPending || previo.afectados === 0}>
            <Pencil className="mr-2 h-4 w-4" />
            {aplicar.isPending ? 'Aplicando…' : `Aplicar a ${previo.afectados} productos`}
          </Button>
        </div>
      )}
    </div>
  );
}
