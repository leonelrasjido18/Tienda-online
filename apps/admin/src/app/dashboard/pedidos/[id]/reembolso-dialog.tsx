'use client';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea,
} from '@tienda/ui';
import { formatCentsAsArs, parseArsToCents, type OrderDetailDto } from '@tienda/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

interface Props {
  order: OrderDetailDto;
  abierto: boolean;
  onClose: () => void;
}

/** Cobrado menos lo ya devuelto: el tope de lo que se puede reembolsar. */
export function calcularReembolsable(order: OrderDetailDto): { cobrado: number; devuelto: number; resta: number } {
  const aprobados = order.payments.filter((p) => p.status === 'APPROVED');
  const cobrado = aprobados
    .filter((p) => p.kind !== 'REFUND')
    .reduce((suma, p) => suma + p.amountCents, 0);
  const devuelto = aprobados
    .filter((p) => p.kind === 'REFUND')
    .reduce((suma, p) => suma + Math.abs(p.amountCents), 0);
  return { cobrado, devuelto, resta: Math.max(0, cobrado - devuelto) };
}

export function ReembolsoDialog({ order, abierto, onClose }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();

  const { cobrado, devuelto, resta } = calcularReembolsable(order);
  const [montoText, setMontoText] = useState((resta / 100).toString());
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  let montoCents = 0;
  try {
    montoCents = parseArsToCents(montoText);
  } catch {
    montoCents = 0;
  }
  const excedido = montoCents > resta;
  const valido = montoCents > 0 && !excedido;

  const devolver = useMutation({
    mutationFn: () =>
      api(`/admin/orders/${order.id}/refund`, {
        method: 'POST',
        body: JSON.stringify({ amountCents: montoCents, reason: motivo.trim() || undefined }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders', order.id] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo hacer la devolución'),
  });

  return (
    <Dialog open={abierto} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Devolver dinero del pedido {order.displayNumber}</DialogTitle>
          <DialogDescription>
            Si el pago entró por la pasarela, la devolución se pide ahí mismo. Si fue transferencia o
            efectivo, se registra acá y la plata la devolvés vos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cobrado</span>
            <span className="tabular-nums">{formatCentsAsArs(cobrado)}</span>
          </div>
          {devuelto > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ya devuelto</span>
              <span className="tabular-nums">−{formatCentsAsArs(devuelto)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <span>Se puede devolver</span>
            <span className="tabular-nums">{formatCentsAsArs(resta)}</span>
          </div>
        </div>

        {resta === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este pedido no tiene saldo para devolver: o no se cobró, o ya se devolvió todo.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="monto">Monto a devolver (ARS)</Label>
              <Input
                id="monto"
                inputMode="decimal"
                value={montoText}
                onChange={(e) => {
                  setMontoText(e.target.value);
                  setError(null);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setMontoText((resta / 100).toString())}>
                  Devolver todo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMontoText((Math.round(resta / 2) / 100).toString())}
                >
                  La mitad
                </Button>
              </div>
              {excedido && (
                <p className="text-sm text-destructive">
                  No podés devolver más de {formatCentsAsArs(resta)}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo (opcional)</Label>
              <Textarea
                id="motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Talle equivocado, producto con falla…"
              />
              <p className="text-xs text-muted-foreground">Queda en el historial del pedido.</p>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
              <p className="text-xs text-muted-foreground">
                Una devolución no se deshace. Si la pasarela la rechaza, no se registra nada.
              </p>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                className="flex-1"
                disabled={!valido || devolver.isPending}
                onClick={() => {
                  setError(null);
                  devolver.mutate();
                }}
              >
                <Undo2 className="mr-2 h-4 w-4" />
                {devolver.isPending ? 'Devolviendo…' : `Devolver ${formatCentsAsArs(montoCents)}`}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
