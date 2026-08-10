'use client';

import { formatCentsAsArs, type OrderDetailDto } from '@tienda/shared';
import { buttonVariants } from '@tienda/ui';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { clientFetch } from '@/lib/client-api';

const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Pago aprobado',
  rechazado: 'El pago fue rechazado',
  pendiente: 'Tu pago está pendiente de acreditación',
};

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const estado = searchParams.get('estado');
  const [order, setOrder] = useState<OrderDetailDto | null>(null);
  const [bankTransferInstructions, setBankTransferInstructions] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<OrderDetailDto>(`/orders/${params.id}`)
      .then(setOrder)
      .catch(() => undefined);
  }, [params.id]);

  useEffect(() => {
    if (!order?.payments.some((p) => p.provider === 'bank_transfer' && p.status === 'PENDING')) return;
    clientFetch<{ bankTransferInstructions: string | null }>('/settings')
      .then((s) => setBankTransferInstructions(s.bankTransferInstructions))
      .catch(() => undefined);
  }, [order]);

  if (!order) {
    return <p className="mx-auto max-w-xl px-4 py-8 text-sm text-muted-foreground">Cargando…</p>;
  }

  const pendingBankTransfer = order.payments.find((p) => p.provider === 'bank_transfer' && p.status === 'PENDING');

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">¡Gracias, {order.contactName.split(' ')[0]}!</h1>
      <p className="mt-2 text-muted-foreground">
        Tu pedido {order.displayNumber} fue registrado{estado ? ` — ${ESTADO_LABELS[estado] ?? estado}` : ''}.
      </p>

      <div className="mt-6 rounded-lg border border-border p-4 text-left">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total del pedido</dt>
            <dd>{formatCentsAsArs(order.totalCents)}</dd>
          </div>
          {order.paymentPlan === 'DEPOSIT_BALANCE' && order.balanceCents !== null && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Saldo pendiente (al recibir)</dt>
              <dd>{formatCentsAsArs(order.balanceCents)}</dd>
            </div>
          )}
        </dl>
      </div>

      {pendingBankTransfer && (
        <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-left text-sm">
          <p className="font-medium">Transferí {formatCentsAsArs(pendingBankTransfer.amountCents)} para confirmar tu pedido.</p>
          <p className="mt-1 text-muted-foreground">
            Te vamos a avisar por email apenas confirmemos la recepción de la transferencia.
          </p>
          {bankTransferInstructions && (
            <p className="mt-3 whitespace-pre-line border-t border-border pt-3 text-muted-foreground">
              {bankTransferInstructions}
            </p>
          )}
        </div>
      )}

      <Link href="/productos" className={buttonVariants({ className: 'mt-8' })}>
        Seguir comprando
      </Link>
    </div>
  );
}
