'use client';

import {
  formatCentsAsArs,
  PAYMENT_METHOD_LABELS,
  type BalanceCheckoutDto,
  type CheckoutPaymentMethod,
  type PayBalanceResponse,
  type PublicStoreSettingsDto,
} from '@tienda/shared';
import { Button, Card, CardContent } from '@tienda/ui';
import { CreditCard, Landmark, PackageCheck } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { clientFetch } from '@/lib/client-api';
import { resolveImageUrl } from '@/lib/media';

export default function BalancePage() {
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<BalanceCheckoutDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [method, setMethod] = useState<CheckoutPaymentMethod>('bank_transfer');
  const [enabledMethods, setEnabledMethods] = useState<CheckoutPaymentMethod[]>(['bank_transfer']);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientFetch<BalanceCheckoutDto>(`/balance/${params.token}`)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [params.token]);

  // Qué pasarela está activa lo decide el servidor, no esta página.
  useEffect(() => {
    let cancelled = false;
    clientFetch<PublicStoreSettingsDto>('/settings')
      .then((s) => {
        if (cancelled) return;
        const methods = s.enabledPaymentMethods as CheckoutPaymentMethod[];
        if (methods.length > 0) {
          setEnabledMethods(methods);
          setMethod(methods[0]!);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (notFound) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">No encontramos este pago</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Puede que el link esté incompleto. Revisá el email que te mandamos o escribinos.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="mx-auto max-w-xl px-4 py-20 text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  if (data.status === 'PAID') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <PackageCheck className="mx-auto h-12 w-12 text-emerald-600" />
        <h1 className="mt-4 text-2xl font-bold">Este pedido ya está pago</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Recibimos el pago del pedido {data.orderDisplayNumber}. Te avisamos por email cuando lo despachemos.
        </p>
      </div>
    );
  }

  if (data.status === 'EXPIRED' || data.status === 'CANCELLED') {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold">El link venció</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          El link de pago del pedido {data.orderDisplayNumber} ya no está vigente. Escribinos y te generamos uno
          nuevo — tu pedido sigue reservado.
        </p>
      </div>
    );
  }

  async function handlePay() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await clientFetch<PayBalanceResponse>(`/balance/${params.token}/pay`, {
        method: 'POST',
        body: JSON.stringify({ paymentMethod: method }),
      });
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      setInstructions(res.bankTransferInstructions ?? 'Te enviamos los datos para transferir por email.');
    } catch {
      setError('No pudimos iniciar el pago. Intentá de nuevo en unos minutos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <div className="text-center">
        <PackageCheck className="mx-auto h-10 w-10 text-accent" />
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">¡Llegó tu pedido!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hola {data.contactName.split(' ')[0]}, tu pedido {data.orderDisplayNumber} ya está acá. Resta abonar el
          saldo y el envío para despacharlo.
        </p>
      </div>

      <Card className="mt-6 border border-border">
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Tu pedido</h2>
          <div className="space-y-3">
            {data.items.map((item, i) => (
              <div key={i} className="flex gap-3">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveImageUrl(item.imageUrl)} alt="" className="h-14 w-14 shrink-0 rounded object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded bg-muted" />
                )}
                <div className="text-sm">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.optionsLabel} · x{item.quantity}
                  </p>
                  {item.playerName && (
                    <p className="text-xs text-muted-foreground">
                      {item.playerName} {item.playerNumber ?? ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4 border border-border">
        <CardContent className="p-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Saldo del pedido</dt>
              <dd>{formatCentsAsArs(data.balanceCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Envío {data.pickupInStore ? '(retiro en el local)' : ''}
              </dt>
              <dd>{formatCentsAsArs(data.shippingCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total a pagar</dt>
              <dd>{formatCentsAsArs(data.amountCents)}</dd>
            </div>
          </dl>
          {data.shippingAddress && (
            <p className="mt-3 text-xs text-muted-foreground">Enviamos a: {data.shippingAddress}</p>
          )}
        </CardContent>
      </Card>

      {instructions ? (
        <Card className="mt-4 border border-border bg-muted/30">
          <CardContent className="p-4 text-sm">
            <p className="font-medium">Transferí {formatCentsAsArs(data.amountCents)} para completar tu pedido.</p>
            <p className="mt-2 whitespace-pre-line text-muted-foreground">{instructions}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 space-y-3">
          <p className="text-sm font-medium">Elegí cómo pagar</p>
          {enabledMethods.map((m) => {
            const Icon = m === 'bank_transfer' ? Landmark : CreditCard;
            return (
              <label
                key={m}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"
              >
                <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
                <Icon className="h-4 w-4 text-muted-foreground" />
                {PAYMENT_METHOD_LABELS[m]}
              </label>
            );
          })}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" disabled={isSubmitting} onClick={() => void handlePay()}>
            {isSubmitting ? 'Procesando…' : `Pagar ${formatCentsAsArs(data.amountCents)}`}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            El link vence el {new Date(data.expiresAt).toLocaleDateString('es-AR')}.
          </p>
        </div>
      )}
    </div>
  );
}
