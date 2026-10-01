'use client';

import { Badge, Button } from '@tienda/ui';
import { formatCentsAsArs, type OrderDetailDto } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Undo2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

import { resolveImageUrl } from '@/lib/media';
import { useApi } from '@/lib/use-api';
import { calcularReembolsable, ReembolsoDialog } from './reembolso-dialog';

const FINANCIAL_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  DEPOSIT_PAID: 'Seña pagada',
  AWAITING_BALANCE: 'Espera saldo',
  PAID: 'Pagado',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  EXPIRED: 'Expirado',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  REFUNDED: 'Reembolsado',
  CANCELLED: 'Cancelado',
};

const EVENT_LABELS: Record<string, string> = {
  created: 'Pedido creado',
  payment_approved: 'Pago aprobado',
  expired: 'Reserva vencida',
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const api = useApi();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'orders', params.id],
    queryFn: () => api<OrderDetailDto>(`/admin/orders/${params.id}`),
  });

  const [avisoCorreo, setAvisoCorreo] = useState<string | null>(null);
  const [reembolsoAbierto, setReembolsoAbierto] = useState(false);

  // Reenvío de la confirmación: hace falta cuando el correo no salió (SMTP
  // caído) o cuando se corrigió un pedido a mano.
  const resendConfirmation = useMutation({
    mutationFn: () =>
      api<{ sentTo: string }>(`/admin/orders/${params.id}/resend-confirmation`, { method: 'POST' }),
    onSuccess: (r) => {
      setAvisoCorreo(`Confirmación enviada a ${r.sentTo}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders', params.id] });
    },
    onError: (err) =>
      setAvisoCorreo(err instanceof Error ? err.message : 'No se pudo reenviar la confirmación'),
  });

  const approveTransfer = useMutation({
    mutationFn: (paymentId: string) =>
      api<OrderDetailDto>(`/admin/orders/${params.id}/payments/${paymentId}/approve-transfer`, { method: 'POST' }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'orders', params.id], updated);
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });

  if (isLoading || !order) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  const address = order.pickupInStore
    ? 'Retira en el local'
    : [
        [order.shippingStreet, order.shippingNumber].filter(Boolean).join(' '),
        order.shippingFloor,
        order.shippingCity,
        order.shippingProvince,
        order.shippingPostalCode,
      ]
        .filter(Boolean)
        .join(', ');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Pedido {order.displayNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {order.contactName} · {order.contactEmail}
            {order.contactPhone ? ` · ${order.contactPhone}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge>{FINANCIAL_STATUS_LABELS[order.financialStatus]}</Badge>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAvisoCorreo(null);
                resendConfirmation.mutate();
              }}
              disabled={resendConfirmation.isPending}
            >
              <Mail className="mr-2 h-3.5 w-3.5" />
              {resendConfirmation.isPending ? 'Enviando…' : 'Reenviar confirmación'}
            </Button>
            {/* Sólo si hay plata cobrada que devolver. */}
            {calcularReembolsable(order).resta > 0 && (
              <Button variant="outline" size="sm" onClick={() => setReembolsoAbierto(true)}>
                <Undo2 className="mr-2 h-3.5 w-3.5" />
                Devolver dinero
              </Button>
            )}
          </div>
          {avisoCorreo && <p className="max-w-xs text-right text-xs text-muted-foreground">{avisoCorreo}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">Productos</h2>
            <div className="space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={resolveImageUrl(item.imageUrl)} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-16 w-16 shrink-0 rounded bg-muted" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantSku}
                      {item.optionsLabel ? ` · ${item.optionsLabel}` : ''} · x{item.quantity}
                    </p>
                    {item.customization && (
                      <p className="text-xs text-muted-foreground">
                        Personalización: {item.customization.playerName ?? '—'}{' '}
                        {item.customization.playerNumber ?? ''}
                      </p>
                    )}
                    <Badge variant={item.fulfillmentMode === 'PREORDER' ? 'secondary' : 'outline'} className="mt-1">
                      {item.fulfillmentMode === 'PREORDER' ? 'Por encargo' : 'Entrega inmediata'}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium">{formatCentsAsArs(item.totalCents)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">Envío</h2>
            <p className="text-sm text-muted-foreground">{address}</p>
            {order.shippingNotes && <p className="mt-1 text-sm text-muted-foreground">{order.shippingNotes}</p>}
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
            <ul className="space-y-2">
              {order.events.map((event) => (
                <li key={event.id} className="text-sm">
                  <span className="text-muted-foreground">
                    {new Date(event.createdAt).toLocaleString('es-AR')} —{' '}
                  </span>
                  {EVENT_LABELS[event.type] ?? event.type}
                  {event.message ? `: ${event.message}` : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">Cobro</h2>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatCentsAsArs(order.subtotalCents)}</dd>
              </div>
              {order.depositCents !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Seña</dt>
                  <dd>{formatCentsAsArs(order.depositCents)}</dd>
                </div>
              )}
              {order.balanceCents !== null && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Saldo</dt>
                  <dd>{formatCentsAsArs(order.balanceCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Envío</dt>
                <dd>{order.shippingCents !== null ? formatCentsAsArs(order.shippingCents) : 'A cotizar'}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-1 font-medium">
                <dt>Total</dt>
                <dd>{formatCentsAsArs(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 text-sm font-semibold">Pagos</h2>
            <div className="space-y-3">
              {order.payments.map((payment) => (
                <div key={payment.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {payment.kind === 'FULL' ? 'Pago total' : payment.kind === 'DEPOSIT' ? 'Seña' : payment.kind}
                    </span>
                    <Badge variant={payment.status === 'APPROVED' ? 'default' : 'outline'}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {payment.provider === 'bank_transfer' ? 'Transferencia bancaria' : 'Mercado Pago'} ·{' '}
                    {formatCentsAsArs(payment.amountCents)}
                  </p>
                  {/* Transferencia y efectivo se confirman a mano. Antes el
                      botón sólo salía en transferencia, así que un pedido en
                      efectivo no se podía marcar como cobrado. */}
                  {(payment.provider === 'bank_transfer' || payment.provider === 'cash') &&
                    payment.status === 'PENDING' && (
                      <Button
                        size="sm"
                        className="mt-2 w-full"
                        disabled={approveTransfer.isPending}
                        onClick={() => approveTransfer.mutate(payment.id)}
                      >
                        {payment.provider === 'cash' ? 'Marcar efectivo como cobrado' : 'Aprobar transferencia'}
                      </Button>
                    )}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <ReembolsoDialog order={order} abierto={reembolsoAbierto} onClose={() => setReembolsoAbierto(false)} />
    </div>
  );
}
