'use client';

import {
  formatCentsAsArs,
  PAYMENT_METHOD_LABELS,
  type PublicOrderDetailDto,
  type CheckoutPaymentMethod,
  type PublicStoreSettingsDto,
  type CreateOrderResponse,
} from '@tienda/shared';
import { buttonVariants, Turnstile } from '@tienda/ui';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Landmark, CreditCard, MessageSquare } from 'lucide-react';

import { clientFetch } from '@/lib/client-api';
import { DatosDePago } from './datos-de-pago';
import { trackEvent } from '@/lib/analytics';

// Estados en los que ya entró dinero: se cuenta como conversión de compra.
const PAID_STATES = ['DEPOSIT_PAID', 'AWAITING_BALANCE', 'PAID'];

const ESTADO_LABELS: Record<string, string> = {
  aprobado: 'Pago aprobado',
  rechazado: 'El pago fue rechazado',
  pendiente: 'Tu pago está pendiente de acreditación',
};

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const estado = searchParams.get('estado');
  const [order, setOrder] = useState<PublicOrderDetailDto | null>(null);
  const [tienda, setTienda] = useState<PublicStoreSettingsDto | null>(null);
  const [bankTransferInstructions, setBankTransferInstructions] = useState<string | null>(null);
  const purchaseTracked = useRef(false);

  // States for retry payment
  const [enabledMethods, setEnabledMethods] = useState<CheckoutPaymentMethod[]>(['bank_transfer']);
  const [selectedMethod, setSelectedMethod] = useState<CheckoutPaymentMethod>('bank_transfer');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    clientFetch<PublicOrderDetailDto>(`/orders/${params.id}`)
      .then((ord) => {
        setOrder(ord);
        // If not bank transfer, show retry payment option immediately by default if order is PENDING
        const hasBank = ord.payments.some(
          (p) => p.provider === 'bank_transfer' && p.status === 'PENDING',
        );
        if (!hasBank) {
          setShowRetry(true);
        }
      })
      .catch(() => undefined);
  }, [params.id]);

  useEffect(() => {
    if (!order?.payments.some((p) => p.provider === 'bank_transfer' && p.status === 'PENDING'))
      return;
    clientFetch<PublicStoreSettingsDto>('/settings')
      .then((s) => {
        setBankTransferInstructions(s.bankTransferInstructions);
        setTienda(s);
      })
      .catch(() => undefined);
  }, [order]);

  useEffect(() => {
    if (order?.financialStatus === 'PENDING') {
      clientFetch<PublicStoreSettingsDto>('/settings')
        .then((s) => {
          const methods = s.enabledPaymentMethods as CheckoutPaymentMethod[];
          if (methods.length > 0) {
            setEnabledMethods(methods);
            setSelectedMethod(methods[0]!);
          }
        })
        .catch(() => undefined);
    }
  }, [order]);

  // Conversión de compra para GA4 (se dispara una sola vez, con dedup por número de pedido).
  useEffect(() => {
    if (!order || purchaseTracked.current) return;
    if (PAID_STATES.includes(order.financialStatus)) {
      purchaseTracked.current = true;
      trackEvent('purchase', {
        transaction_id: order.displayNumber,
        value: order.totalCents / 100,
        currency: 'ARS',
      });
    }
  }, [order]);

  if (!order) {
    return <p className="mx-auto max-w-xl px-4 py-8 text-sm text-muted-foreground">Cargando…</p>;
  }

  // Transferencia y efectivo comparten pantalla: los dos se pagan fuera de la
  // web y necesitan lo mismo (monto, datos y cómo mandar el comprobante).
  const pagoEnMano = order.payments.find(
    (p) => (p.provider === 'bank_transfer' || p.provider === 'cash') && p.status === 'PENDING',
  );

  async function handleRetryPayment() {
    setRetryError(null);
    setRetrying(true);
    try {
      const res = await clientFetch<CreateOrderResponse>(`/checkout/${params.id}/retry`, {
        method: 'POST',
        headers: turnstileToken ? { 'x-turnstile-token': turnstileToken } : undefined,
        body: JSON.stringify({ paymentMethod: selectedMethod }),
      });

      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }

      // If changed to bank transfer or no redirect, reload order details
      const updatedOrder = await clientFetch<PublicOrderDetailDto>(`/orders/${params.id}`);
      setOrder(updatedOrder);
      if (res.bankTransferInstructions) {
        setBankTransferInstructions(res.bankTransferInstructions);
      }
      setShowRetry(false);
    } catch (err) {
      setRetryError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al procesar el pago. Intente nuevamente.',
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 text-center">
      <h1 className="text-2xl font-semibold">¡Gracias, {order.contactName.split(' ')[0]}!</h1>
      <p className="mt-2 text-muted-foreground">
        Tu pedido {order.displayNumber} fue registrado
        {estado ? ` — ${ESTADO_LABELS[estado] ?? estado}` : ''}.
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

      {!order.pickupInStore && tienda?.whatsappPhone && (
        <div className="mt-6 rounded-lg border border-accent/30 bg-accent/10 p-4 text-left">
          <p className="text-sm font-semibold text-foreground">Falta coordinar el envío</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Con tu dirección cotizamos el despacho. Escribinos por WhatsApp y cerramos el costo y la
            forma de pago del envío.
          </p>
          <a
            href={`https://wa.me/${tienda.whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
              `Hola! Acabo de hacer el pedido ${order.displayNumber} y quiero coordinar el envío.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            <MessageSquare className="h-4 w-4" /> Coordinar por WhatsApp
          </a>
        </div>
      )}

      {pagoEnMano && !showRetry && (
        <>
          <DatosDePago
            metodo={pagoEnMano.provider as 'bank_transfer' | 'cash'}
            montoCents={pagoEnMano.amountCents}
            numeroPedido={order.displayNumber}
            nombreCliente={order.contactName}
            instrucciones={bankTransferInstructions}
            direccionRetiro={tienda?.pickupAddress ?? null}
            whatsappPhone={tienda?.whatsappPhone ?? null}
          />
          <div className="mt-3 text-left">
            <button
              onClick={() => setShowRetry(true)}
              className="text-xs font-semibold text-accent hover:underline"
            >
              ¿Preferís pagar online con tarjeta de crédito o débito?
            </button>
          </div>
        </>
      )}

      {order.financialStatus === 'PENDING' && showRetry && (
        <div className="mt-6 rounded-lg border border-border p-5 bg-card text-left space-y-4">
          <h2 className="text-sm font-bold text-foreground">Completar el pago de tu pedido</h2>
          <p className="text-xs text-muted-foreground">
            Seleccioná cómo querés realizar el pago de la seña o total para confirmar tu compra.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {enabledMethods.map((method) => {
              const Icon = method === 'bank_transfer' ? Landmark : CreditCard;
              return (
                <label
                  key={method}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ' +
                    (selectedMethod === method
                      ? 'border-accent bg-accent/10 font-semibold'
                      : 'border-border bg-card hover:bg-secondary')
                  }
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={selectedMethod === method}
                    onChange={() => setSelectedMethod(method)}
                    className="sr-only"
                  />
                  <Icon className="h-4 w-4 text-accent shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {PAYMENT_METHOD_LABELS[method]}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          {selectedMethod !== 'bank_transfer' && (
            <Turnstile
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken(null)}
              onError={() => setTurnstileToken(null)}
              className="flex justify-center py-2"
            />
          )}

          {retryError && <p className="text-xs text-destructive">{retryError}</p>}

          <div className="flex gap-2">
            {pagoEnMano && (
              <button
                type="button"
                onClick={() => setShowRetry(false)}
                className="w-1/3 rounded-md border border-border py-2 text-xs font-bold text-muted-foreground hover:bg-muted/10"
              >
                Volver
              </button>
            )}
            <button
              onClick={() => void handleRetryPayment()}
              disabled={retrying || (selectedMethod !== 'bank_transfer' && !turnstileToken)}
              className={
                'rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground hover:bg-primary/95 disabled:opacity-50 ' +
                (pagoEnMano ? 'w-2/3' : 'w-full')
              }
            >
              {retrying
                ? 'Procesando...'
                : selectedMethod === 'bank_transfer'
                  ? 'Elegir transferencia'
                  : 'Pagar ahora'}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8">
        <Link href="/productos" className={buttonVariants()}>
          Seguir comprando
        </Link>
      </div>
    </div>
  );
}
