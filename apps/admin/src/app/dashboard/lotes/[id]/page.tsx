'use client';

import {
  Badge,
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
import {
  formatCentsAsArs,
  IMPORT_BATCH_STATUS_LABELS,
  IMPORT_BATCH_TRANSITIONS,
  type ImportBatchDetailDto,
  type ImportBatchOrderDto,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function BatchDetailPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();
  const [assignOpen, setAssignOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const batchKey = ['admin', 'batches', params.id];

  const { data: batch, isLoading } = useQuery({
    queryKey: batchKey,
    queryFn: () => api<ImportBatchDetailDto>(`/admin/batches/${params.id}`),
  });

  const { data: assignable } = useQuery({
    queryKey: ['admin', 'batches', 'assignable'],
    queryFn: () => api<ImportBatchOrderDto[]>('/admin/batches/assignable-orders'),
    enabled: assignOpen,
  });

  const refresh = (updated: ImportBatchDetailDto) => {
    queryClient.setQueryData(batchKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
  };

  const advanceMutation = useMutation({
    mutationFn: (status: string) =>
      api<ImportBatchDetailDto>(`/admin/batches/${params.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (updated) => {
      setError(null);
      refresh(updated);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo avanzar el lote'),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      api<ImportBatchDetailDto>(`/admin/batches/${params.id}/orders`, {
        method: 'POST',
        body: JSON.stringify({ orderIds: selected }),
      }),
    onSuccess: (updated) => {
      setAssignOpen(false);
      setSelected([]);
      refresh(updated);
    },
  });

  const removeOrderMutation = useMutation({
    mutationFn: (orderId: string) =>
      api<ImportBatchDetailDto>(`/admin/batches/${params.id}/orders/${orderId}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const markPaidMutation = useMutation({
    mutationFn: (orderId: string) =>
      api(`/admin/batches/orders/${orderId}/mark-balance-paid`, {
        method: 'POST',
        body: JSON.stringify({ note: 'Cobrado por fuera del sistema' }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: batchKey }),
  });

  if (isLoading || !batch) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const nextStates = IMPORT_BATCH_TRANSITIONS[batch.status];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{batch.code}</h1>
          <p className="text-sm text-muted-foreground">
            {batch.supplier ?? 'Sin proveedor'} · {batch.orderCount} pedido(s) ·{' '}
            {formatCentsAsArs(batch.pendingBalanceCents)} de saldo
          </p>
        </div>
        <Badge>{IMPORT_BATCH_STATUS_LABELS[batch.status]}</Badge>
      </div>

      <PreorderWindowSection batch={batch} batchId={params.id} />

      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Avanzar el lote</h2>
        {nextStates.length === 0 ? (
          <p className="text-sm text-muted-foreground">El lote está cerrado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {nextStates.map((status) => (
              <Button
                key={status}
                size="sm"
                variant={status === 'RECEIVED' ? 'default' : 'outline'}
                disabled={advanceMutation.isPending}
                onClick={() => advanceMutation.mutate(status)}
              >
                {IMPORT_BATCH_STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        )}
        {batch.status !== 'RECEIVED' && batch.status !== 'CLOSED' && nextStates.includes('RECEIVED') && (
          <p className="mt-3 text-xs text-amber-600">
            Al marcar &ldquo;Recibido&rdquo; se cotiza el envío de cada pedido, se generan los links de cobro y se
            manda el email a cada cliente. No se puede deshacer.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pedidos del lote</h2>
          {batch.status === 'OPEN' && (
            <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
              Sumar pedidos
            </Button>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Saldo</TableHead>
              <TableHead>Envío</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {batch.orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Sin pedidos asignados.
                </TableCell>
              </TableRow>
            )}
            {batch.orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/dashboard/pedidos/${order.id}`} className="font-medium hover:underline">
                    {order.displayNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{order.contactName}</div>
                  <div className="text-xs text-muted-foreground">{order.contactEmail}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.pickupInStore ? 'Retira en local' : (order.province ?? '—')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.balanceCents !== null ? formatCentsAsArs(order.balanceCents) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.shippingCents !== null ? formatCentsAsArs(order.shippingCents) : 'A cotizar'}
                </TableCell>
                <TableCell>
                  <Badge variant={order.financialStatus === 'PAID' ? 'default' : 'outline'}>
                    {order.financialStatus === 'PAID'
                      ? 'Pagado'
                      : order.financialStatus === 'AWAITING_BALANCE'
                        ? 'Espera saldo'
                        : 'Seña pagada'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {batch.status === 'OPEN' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => removeOrderMutation.mutate(order.id)}
                    >
                      Quitar
                    </Button>
                  ) : order.financialStatus === 'AWAITING_BALANCE' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={markPaidMutation.isPending}
                      onClick={() => {
                        if (confirm('¿Marcar el saldo de este pedido como cobrado?')) {
                          markPaidMutation.mutate(order.id);
                        }
                      }}
                    >
                      Cobrado
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Historial</h2>
        <ul className="space-y-1.5">
          {batch.events.map((event) => (
            <li key={event.id} className="text-sm">
              <span className="text-muted-foreground">
                {new Date(event.createdAt).toLocaleString('es-AR')} —{' '}
              </span>
              {event.message ?? event.type}
            </li>
          ))}
        </ul>
      </section>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sumar pedidos al lote</DialogTitle>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {assignable?.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay pedidos por encargo con la seña cobrada esperando lote.
              </p>
            )}
            {assignable?.map((order) => (
              <label key={order.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(order.id)}
                    onChange={(e) =>
                      setSelected((ids) => (e.target.checked ? [...ids, order.id] : ids.filter((i) => i !== order.id)))
                    }
                  />
                  <span>
                    <span className="font-medium">{order.displayNumber}</span> · {order.contactName}
                    <span className="block text-xs text-muted-foreground">
                      {order.pickupInStore ? 'Retira en local' : (order.province ?? 'Sin provincia')}
                    </span>
                  </span>
                </span>
                <span className="text-muted-foreground">
                  {order.balanceCents !== null ? formatCentsAsArs(order.balanceCents) : '—'}
                </span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={selected.length === 0 || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? 'Agregando…' : `Agregar ${selected.length} pedido(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Convierte un ISO a valor para <input type="datetime-local"> en hora local. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function PreorderWindowSection({ batch, batchId }: { batch: ImportBatchDetailDto; batchId: string }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const batchKey = ['admin', 'batches', batchId];

  const [closesAtLocal, setClosesAtLocal] = useState(toLocalInput(batch.closesAt));
  const [promisedDays, setPromisedDays] = useState((batch.promisedDeliveryDays ?? 20).toString());
  const [minUnits, setMinUnits] = useState(batch.minUnits.toString());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const onUpdated = (updated: ImportBatchDetailDto) => {
    queryClient.setQueryData(batchKey, updated);
    void queryClient.invalidateQueries({ queryKey: ['admin', 'batches'] });
  };

  const activeMutation = useMutation({
    mutationFn: (isActive: boolean) =>
      api<ImportBatchDetailDto>(`/admin/batches/${batchId}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: onUpdated,
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo activar la ventana'),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      // Se reenvían los valores actuales para no borrar el resto (el update reemplaza todo).
      api<ImportBatchDetailDto>(`/admin/batches/${batchId}`, {
        method: 'PUT',
        body: JSON.stringify({
          supplier: batch.supplier,
          closesAt: closesAtLocal ? new Date(closesAtLocal).toISOString() : null,
          etaDate: batch.etaDate,
          promisedDeliveryDays: Number(promisedDays) || null,
          minUnits: Number(minUnits) || 12,
          trackingRef: batch.trackingRef,
          freightCents: batch.freightCents,
          customsCents: batch.customsCents,
          otherfeeCents: batch.otherfeeCents,
          notes: batch.notes,
        }),
      }),
    onSuccess: (updated) => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onUpdated(updated);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar la ventana'),
  });

  const pct = batch.minUnits > 0 ? Math.min(100, Math.round((batch.unitCount / batch.minUnits) * 100)) : 0;
  const reached = batch.unitCount >= batch.minUnits;
  const closesPassed = batch.closesAt ? new Date(batch.closesAt) < new Date() : false;

  return (
    <section className="space-y-4 rounded-lg border border-border bg-background p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ventana de encargo</h2>
        {batch.isActive ? (
          <Button size="sm" variant="outline" disabled={activeMutation.isPending} onClick={() => activeMutation.mutate(false)}>
            Desactivar ventana
          </Button>
        ) : (
          <Button size="sm" disabled={activeMutation.isPending || batch.status !== 'OPEN'} onClick={() => activeMutation.mutate(true)}>
            Activar como ventana pública
          </Button>
        )}
      </div>

      {batch.isActive && (
        <p className="text-xs text-emerald-600">
          Esta es la ventana pública: la tienda muestra la cuenta regresiva y los pedidos por encargo se suman solos acá.
          {closesPassed && ' ⚠️ El cierre ya pasó: la cuenta regresiva no se muestra.'}
        </p>
      )}

      {/* Progreso hacia el cupo mínimo (sólo lo ve el panel). */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progreso del cupo</span>
          <span className={reached ? 'font-semibold text-emerald-600' : 'font-semibold text-foreground'}>
            {batch.unitCount} / {batch.minUnits} unidades
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={'h-full rounded-full ' + (reached ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${pct}%` }} />
        </div>
        {!reached && (
          <p className="mt-1 text-xs text-muted-foreground">
            Faltan {batch.minUnits - batch.unitCount} para llegar al mínimo. Podés extender el cierre para que se llene.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-1">
          <Label htmlFor="closesAt">Cierre (cuenta regresiva)</Label>
          <Input id="closesAt" type="datetime-local" value={closesAtLocal} onChange={(e) => setClosesAtLocal(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="promisedDays">Días de llegada (tras el cierre)</Label>
          <Input id="promisedDays" type="number" min={1} value={promisedDays} onChange={(e) => setPromisedDays(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="minUnits">Cupo mínimo (unidades)</Label>
          <Input id="minUnits" type="number" min={1} value={minUnits} onChange={(e) => setMinUnits(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? 'Guardando…' : 'Guardar ventana'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Guardado.</p>}
      </div>
    </section>
  );
}
