'use client';

import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@tienda/ui';
import { formatCentsAsArs, type OrderDetailDto, type OrderItemDto } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ExternalLink, Loader2, MapPin, Package, Sparkles, Store, User } from 'lucide-react';
import Link from 'next/link';

import { useApi } from '@/lib/use-api';
import { resolveImageUrl } from '@/lib/media';

interface Props {
  orderId: string | null;
  onClose: () => void;
}

/** Campo etiqueta/valor de la ficha del cliente. */
function Dato({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

function Seccion({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof User;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function Producto({ item }: { item: OrderItemDto }) {
  const c = item.customization;
  return (
    <div className="flex gap-3 border-b border-border py-3 last:border-b-0">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveImageUrl(item.imageUrl)}
          alt=""
          className="h-16 w-16 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{item.productName}</p>

        {/* Se prefieren las opciones con nombre; `optionsLabel` es el respaldo
            para pedidos viejos o productos ya borrados. */}
        {item.options.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {item.options.map((o) => (
              <span key={o.name} className="text-xs text-muted-foreground">
                {o.name}: <span className="font-medium text-foreground">{o.value}</span>
              </span>
            ))}
          </div>
        ) : item.optionsLabel ? (
          <p className="mt-1 text-xs text-muted-foreground">{item.optionsLabel}</p>
        ) : null}

        <p className="mt-1 text-xs text-muted-foreground">
          {item.fulfillmentMode === 'PREORDER' ? 'Por encargo' : 'Stock inmediato'} · Cantidad {item.quantity}
        </p>

        {c && (
          <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-500">
              <Sparkles className="h-3 w-3" />
              Personalizada
            </p>
            <div className="space-y-0.5 text-xs text-foreground">
              {c.playerName && (
                <div>
                  Nombre: <span className="font-semibold">{c.playerName}</span>
                </div>
              )}
              {c.playerNumber !== null && (
                <div>
                  Número: <span className="font-semibold">{c.playerNumber}</span>
                </div>
              )}
              {c.fontName && <div>Tipografía: {c.fontName}</div>}
              {c.patchNames.length > 0 && <div>Parches: {c.patchNames.join(', ')}</div>}
              {c.extraCents > 0 && <div>Adicional: {formatCentsAsArs(c.extraCents)}</div>}
            </div>
            {c.previewImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(c.previewImageUrl)}
                alt="Vista previa de la personalización"
                className="mt-2 h-24 w-auto rounded border border-border object-contain"
              />
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 text-right text-sm tabular-nums">{formatCentsAsArs(item.totalCents)}</div>
    </div>
  );
}

export function OrderPreviewDialog({ orderId, onClose }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'order', orderId],
    queryFn: () => api<OrderDetailDto>(`/admin/orders/${orderId}`),
    enabled: !!orderId,
  });

  // Transferencia y efectivo se confirman a mano. El botón vive también acá
  // porque esta es la pantalla donde el dueño mira el pedido que le avisaron:
  // mandarlo a la ficha completa sólo para tocar un botón era un rodeo.
  const pagoEnMano = data?.payments.find(
    (p) => (p.provider === 'bank_transfer' || p.provider === 'cash') && p.status === 'PENDING',
  );

  const aprobar = useMutation({
    mutationFn: (paymentId: string) =>
      api(`/admin/orders/${orderId}/payments/${paymentId}/approve-transfer`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'order', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
    },
  });

  const direccion = data
    ? [
        [data.shippingStreet, data.shippingNumber].filter(Boolean).join(' '),
        data.shippingFloor,
        data.shippingCity,
        data.shippingProvince,
        data.shippingPostalCode ? `CP ${data.shippingPostalCode}` : null,
      ]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <Dialog open={!!orderId} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pedido {data?.displayNumber ?? ''}</DialogTitle>
          <DialogDescription>Datos del cliente y productos elegidos.</DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando el pedido…
          </div>
        )}

        {isError && (
          <p className="py-12 text-center text-sm text-destructive">
            No pudimos cargar el pedido. Probá de nuevo.
          </p>
        )}

        {data && (
          <div className="space-y-6">
            <Seccion icon={User} title="Cliente">
              <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
                <Dato label="Nombre" value={data.contactName} />
                <Dato label="Email" value={data.contactEmail} />
                <Dato label="Teléfono" value={data.contactPhone} />
                <Dato label="Plan" value={data.paymentPlan === 'FULL' ? 'Pago total' : 'Seña + saldo'} />
              </div>

              <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3">
                {data.pickupInStore ? (
                  <p className="flex items-center gap-2 text-sm">
                    <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium">Retiro en el local</span> — sin costo de envío
                    </span>
                  </p>
                ) : (
                  <div className="flex gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium">Envío a domicilio</p>
                      <p className="break-words text-muted-foreground">
                        {direccion || 'Dirección no cargada'}
                      </p>
                      {data.shippingNotes && (
                        <p className="mt-1 text-xs text-muted-foreground">Nota: {data.shippingNotes}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Seccion>

            {pagoEnMano && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-medium">
                  Falta confirmar el pago de {formatCentsAsArs(pagoEnMano.amountCents)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pagoEnMano.provider === 'cash'
                    ? 'El cliente paga al retirar.'
                    : 'Confirmalo cuando veas la transferencia acreditada.'}
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  disabled={aprobar.isPending}
                  onClick={() => aprobar.mutate(pagoEnMano.id)}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {aprobar.isPending
                    ? 'Confirmando…'
                    : pagoEnMano.provider === 'cash'
                      ? 'Marcar efectivo como cobrado'
                      : 'Aprobar transferencia'}
                </Button>
              </div>
            )}

            <Seccion icon={Package} title={`Productos (${data.items.length})`}>
              <div className="rounded-lg border border-border px-3">
                {data.items.map((item) => (
                  <Producto key={item.id} item={item} />
                ))}
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCentsAsArs(data.subtotalCents)}</span>
                </div>
                {data.shippingCents ? (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Envío</span>
                    <span className="tabular-nums">{formatCentsAsArs(data.shippingCents)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCentsAsArs(data.totalCents)}</span>
                </div>
                {data.paymentPlan === 'DEPOSIT_BALANCE' && data.balanceCents ? (
                  <div className="flex justify-between pt-1 text-muted-foreground">
                    <span>Saldo pendiente</span>
                    <Badge variant="outline" className="tabular-nums">
                      {formatCentsAsArs(data.balanceCents)}
                    </Badge>
                  </div>
                ) : null}
              </div>
            </Seccion>

            <Link
              href={`/dashboard/pedidos/${orderId}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Abrir la ficha completa
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
