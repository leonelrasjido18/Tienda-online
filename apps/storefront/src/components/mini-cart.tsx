'use client';

import { formatCentsAsArs } from '@tienda/shared';
import { buttonVariants, Separator } from '@tienda/ui';
import Link from 'next/link';

import { useCart } from '@/lib/cart-context';
import { resolveImageUrl } from '@/lib/media';

export function MiniCart({ onClose }: { onClose: () => void }) {
  const { cart, isLoading, updateItem, removeItem } = useCart();

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
        <p className="text-sm text-muted-foreground">Tu carrito está vacío</p>
        <Link
          href="/productos"
          onClick={onClose}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto py-4">
        {cart.items.map((item) => (
          <div key={item.id} className="flex gap-3">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolveImageUrl(item.imageUrl)}
                alt=""
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            ) : (
              <div className="h-16 w-16 shrink-0 rounded-md bg-muted" />
            )}
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{item.productName}</p>
              <p className="text-xs text-muted-foreground">{item.optionsLabel}</p>
              {item.customization && (
                <p className="text-xs text-muted-foreground">
                  {item.customization.playerName} {item.customization.playerNumber}
                </p>
              )}
              <div className="mt-1 flex items-center gap-2">
                <select
                  value={item.quantity}
                  onChange={(e) => void updateItem(item.id, Number(e.target.value))}
                  className="rounded border border-input bg-background px-1.5 py-0.5 text-xs"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Quitar
                </button>
              </div>
            </div>
            <p className="shrink-0 text-sm font-medium">{formatCentsAsArs(item.totalCents)}</p>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between font-medium">
          <span>Subtotal</span>
          <span>{formatCentsAsArs(cart.subtotalCents)}</span>
        </div>

        {cart.requiresDeposit && (
          <p className="text-xs text-muted-foreground">
            Incluye productos por encargo — se cobra seña ahora y saldo cuando llega.
          </p>
        )}

        <Link
          href="/carrito"
          onClick={onClose}
          className={buttonVariants({ variant: 'outline', className: 'w-full' })}
        >
          Ver carrito
        </Link>
        <Link
          href="/checkout"
          onClick={onClose}
          className={buttonVariants({ className: 'w-full' })}
        >
          Finalizar compra
        </Link>
      </div>
    </div>
  );
}
