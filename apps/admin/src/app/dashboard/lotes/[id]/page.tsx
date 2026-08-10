'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
