'use client';

import { formatCentsAsArs } from '@tienda/shared';
import { buttonVariants, Card, CardContent } from '@tienda/ui';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingBag, Trash2, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';

import { useCart } from '@/lib/cart-context';
import { resolveImageUrl } from '@/lib/media';

export default function CartPage() {
  const { cart, isLoading, updateItem, removeItem } = useCart();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Cargando carrito…</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <ShoppingBag className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Tu carrito está vacío</h1>
        <p className="mt-2 text-sm text-muted-foreground">Explorá nuestro catálogo para encontrar tu próxima camiseta.</p>
        <Link href="/productos" className={buttonVariants({ className: 'mt-6 gap-2 font-bold' })}>
          Ver camisetas disponibles <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Tu Carrito de Compras</h1>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* Cart Item List */}
        <div className="space-y-4">
          {cart.items.map((item) => (
            <Card key={item.id} className="border border-border">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex gap-4 items-center">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {item.imageUrl ? (
                      <Image
                        src={resolveImageUrl(item.imageUrl)}
                        alt={item.productName}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin foto</div>
                    )}
                  </div>

                  <div className="space-y-1 min-w-0">
                    <p className="text-base font-bold text-foreground truncate">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">{item.optionsLabel}</p>

                    {item.customization && (
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                        <Sparkles className="h-3 w-3" />
                        <span>
                          {item.customization.playerName ?? ''} {item.customization.playerNumber ?? ''}
                        </span>
                      </div>
                    )}

                    {item.available < item.quantity && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" />
                        {item.allowPreorder ? 'Por encargo a China — requiere seña del 50%' : 'Sin stock suficiente'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
                  <span className="text-base font-extrabold text-foreground">{formatCentsAsArs(item.totalCents)}</span>

                  <div className="flex items-center gap-3">
                    <select
                      value={item.quantity}
                      onChange={(e) => void updateItem(item.id, Number(e.target.value))}
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs outline-none"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} u.
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => void removeItem(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      aria-label="Quitar del carrito"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Order Summary Sidebar */}
        <div className="space-y-4">
          <Card className="border border-border bg-card">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-lg font-bold text-foreground">Resumen del pedido</h2>

              <div className="flex items-center justify-between text-base font-bold text-foreground border-b border-border pb-3">
                <span>Subtotal</span>
                <span>{formatCentsAsArs(cart.subtotalCents)}</span>
              </div>

              {cart.requiresDeposit && (
                <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-foreground space-y-1">
                  <p className="font-bold text-accent">Modo Pre-Venta Activo</p>
                  <p className="text-muted-foreground leading-relaxed">
                    Tu carrito contiene productos por encargo. En el checkout abonás únicamente el 50% de seña para iniciar el pedido.
                  </p>
                </div>
              )}

              <Link href="/checkout" className={buttonVariants({ size: 'lg', className: 'w-full gap-2 font-bold' })}>
                Continuar la compra <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
