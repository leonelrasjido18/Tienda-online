'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tienda/ui';
import {
  formatCentsAsArs,
  parseArsToCents,
  type BulkPriceAdjustmentInput,
  type BulkPricePreviewDto,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Eye, TrendingUp } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Liga {
  id: string;
  name: string;
}

interface Ajuste {
  createdAt: string;
  porQuien: string | null;
  detalle: Record<string, unknown> | null;
}

const REDONDEOS = [
  { value: '0', label: 'Sin redondear' },
  { value: '10000', label: 'Al $100' },
  { value: '50000', label: 'Al $500' },
  { value: '100000', label: 'Al $1.000' },
];

export default function PreciosPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'percentage' | 'amount'>('percentage');
  const [valor, setValor] = useState('10');
  const [roundTo, setRoundTo] = useState('10000');
  const [leagueId, setLeagueId] = useState<string>('ALL');
  const [previo, setPrevio] = useState<BulkPricePreviewDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const { data: ligas } = useQuery({
    queryKey: ['admin', 'leagues'],
    queryFn: () => api<Liga[]>('/admin/leagues'),
  });

  const { data: historial } = useQuery({
    queryKey: ['admin', 'pricing', 'history'],
    queryFn: () => api<Ajuste[]>('/admin/pricing/history'),
  });

  function armarCuerpo(): BulkPriceAdjustmentInput {
    return {
      mode,
      // En porcentaje el valor va tal cual; en monto, convertido a centavos.
      value: mode === 'percentage' ? Math.trunc(Number(valor)) : parseArsToCents(valor),
      roundTo: Number(roundTo),
      leagueId: leagueId === 'ALL' ? null : leagueId,
      categoryId: null,
      minPriceCents: 0,
    };
  }

  const previewMutation = useMutation({
    mutationFn: () =>
      api<BulkPricePreviewDto>('/admin/pricing/preview', { method: 'POST', body: JSON.stringify(armarCuerpo()) }),
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

  const applyMutation = useMutation({
    mutationFn: () =>
      api<BulkPricePreviewDto & { variantesActualizadas: number }>('/admin/pricing/apply', {
        method: 'POST',
        body: JSON.stringify(armarCuerpo()),
      }),
    onSuccess: async (d) => {
      setResultado(`Listo: se actualizaron ${d.variantesActualizadas} precios.`);
      setPrevio(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'pricing', 'history'] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo aplicar'),
  });

  const diferencia = previo ? previo.totalDespues - previo.totalAntes : 0;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ajuste de precios</h1>
        <p className="text-sm text-muted-foreground">
          Sube o baja precios en masa, por porcentaje o por monto fijo.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-background p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de ajuste</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as 'percentage' | 'amount')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Porcentaje</SelectItem>
                <SelectItem value="amount">Monto fijo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">{mode === 'percentage' ? 'Porcentaje (%)' : 'Monto (ARS)'}</Label>
            <Input
              id="valor"
              inputMode="decimal"
              value={valor}
              onChange={(e) => {
                setValor(e.target.value);
                setPrevio(null);
              }}
              placeholder={mode === 'percentage' ? '10' : '2000'}
            />
            <p className="text-xs text-muted-foreground">Un valor negativo baja los precios.</p>
          </div>

          <div className="space-y-2">
            <Label>Redondeo</Label>
            <Select
              value={roundTo}
              onValueChange={(v) => {
                setRoundTo(v);
                setPrevio(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REDONDEOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Alcance</Label>
            <Select
              value={leagueId}
              onValueChange={(v) => {
                setLeagueId(v);
                setPrevio(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todo el catálogo</SelectItem>
                {ligas?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {resultado && <p className="text-sm font-medium text-primary">{resultado}</p>}

        <Button onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending || !valor}>
          <Eye className="mr-2 h-4 w-4" />
          {previewMutation.isPending ? 'Simulando…' : 'Simular'}
        </Button>
      </div>

      {previo && (
        <div className="space-y-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-500" />
            <div>
              <p className="font-medium">
                Vas a cambiar {previo.variantesAfectadas} precios en {previo.productosAfectados} productos
              </p>
              <p className="text-sm text-muted-foreground">
                Esto no se puede deshacer con un botón: para volver atrás hay que aplicar el ajuste inverso.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Suma actual</p>
              <p className="text-sm font-semibold tabular-nums">{formatCentsAsArs(previo.totalAntes)}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Suma después</p>
              <p className="text-sm font-semibold tabular-nums">{formatCentsAsArs(previo.totalDespues)}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Diferencia</p>
              <p className="text-sm font-semibold tabular-nums">
                {diferencia >= 0 ? '+' : ''}
                {formatCentsAsArs(diferencia)}
              </p>
            </div>
          </div>

          {previo.ejemplos.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-border bg-background">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-2">Producto</th>
                    <th className="p-2 text-right">Antes</th>
                    <th className="p-2 text-right">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {previo.ejemplos.map((e) => (
                    <tr key={e.sku} className="border-b border-border last:border-0">
                      <td className="p-2">{e.producto}</td>
                      <td className="p-2 text-right tabular-nums text-muted-foreground">
                        {formatCentsAsArs(e.antes)}
                      </td>
                      <td className="p-2 text-right font-medium tabular-nums">{formatCentsAsArs(e.despues)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending || previo.variantesAfectadas === 0}
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            {applyMutation.isPending ? 'Aplicando…' : `Aplicar a ${previo.variantesAfectadas} precios`}
          </Button>
        </div>
      )}

      {historial && historial.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Últimos ajustes
          </h2>
          <ul className="space-y-2 text-sm">
            {historial.map((h, i) => {
              const d = (h.detalle ?? {}) as Record<string, number | string>;
              const signo = Number(d.value) >= 0 ? '+' : '';
              const texto =
                d.mode === 'percentage'
                  ? `${signo}${d.value}%`
                  : `${signo}${formatCentsAsArs(Number(d.value) || 0)}`;
              return (
                <li key={i} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
                  <span>
                    <span className="font-medium">{texto}</span>{' '}
                    <span className="text-muted-foreground">
                      · {String(d.variantesActualizadas ?? 0)} precios
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString('es-AR')}
                    {h.porQuien ? ` · ${h.porQuien}` : ''}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
