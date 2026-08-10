'use client';

import {
  calculatePaymentPlan,
  formatCentsAsArs,
  PAYMENT_METHOD_LABELS,
  type CheckoutPaymentMethod,
  type CreateOrderResponse,
  type PublicStoreSettingsDto,
  type ResolvedFulfillment,
} from '@tienda/shared';
import { Button, Input, Label, Card, CardContent } from '@tienda/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Truck, Store, CreditCard, Landmark, CheckCircle2, ArrowRight } from 'lucide-react';

import { clientFetch } from '@/lib/client-api';
import { useCart } from '@/lib/cart-context';

type Step = 'contact' | 'shipping' | 'payment';
type ShippingMethod = 'pickup' | 'delivery';

function resolveItemFulfillment(item: {
  fulfillmentMode: string;
  available: number;
  quantity: number;
  allowPreorder: boolean;
}): ResolvedFulfillment {
  if (item.fulfillmentMode === 'PREORDER') return 'PREORDER';
  if (item.available >= item.quantity) return 'IN_STOCK';
  return item.allowPreorder ? 'PREORDER' : 'IN_STOCK';
}

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, isLoading } = useCart();
  const [step, setStep] = useState<Step>('contact');
  const [depositPercent, setDepositPercent] = useState(50);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('pickup');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [shippingNotes, setShippingNotes] = useState('');

  // La transferencia siempre está disponible, así que sirve de valor inicial
  // seguro hasta que el servidor diga qué pasarela está activa.
  const [enabledMethods, setEnabledMethods] = useState<CheckoutPaymentMethod[]>(['bank_transfer']);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>('bank_transfer');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    clientFetch<PublicStoreSettingsDto>('/settings')
      .then((s) => {
        if (cancelled) return;
        setDepositPercent(s.defaultDepositPercent);
        const methods = s.enabledPaymentMethods as CheckoutPaymentMethod[];
        if (methods.length > 0) {
          setEnabledMethods(methods);
          setPaymentMethod(methods[0]!);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const plan = useMemo(() => {
    if (!cart) return null;
    const lines = cart.items.map((item) => ({
      totalCents: item.totalCents,
      fulfillment: resolveItemFulfillment(item),
    }));
    return calculatePaymentPlan(lines, depositPercent);
  }, [cart, depositPercent]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Cargando datos de la compra…</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Tu carrito está vacío</h1>
        <p className="mt-2 text-sm text-muted-foreground">Agregá productos antes de continuar con la compra.</p>
        <Button onClick={() => router.push('/productos')} className="mt-6">
          Ver productos disponibles
        </Button>
      </div>
    );
  }

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const shipping =
        shippingMethod === 'pickup'
          ? { method: 'pickup' as const }
          : {
              method: 'delivery' as const,
              street,
              number: number || undefined,
              floor: floor || undefined,
              city,
              province,
              postalCode,
              notes: shippingNotes || undefined,
            };

      const response = await clientFetch<CreateOrderResponse>('/checkout', {
        method: 'POST',
        body: JSON.stringify({
          contact: { name, email, phone: phone || undefined },
          shipping,
          paymentMethod,
          notes: notes || undefined,
        }),
      });

      if (response.redirectUrl) {
        window.location.href = response.redirectUrl;
        return;
      }
      router.push(`/pedido/${response.orderToken}`);
    } catch {
      setSubmitError('No pudimos confirmar el pedido. Revisá los datos e intentá de nuevo.');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Progress Indicator */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Finalizar compra</h1>
        <div className="mt-4 flex items-center justify-between">
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'contact' ? 'text-accent' : 'text-foreground'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">1</span>
            Contacto
          </div>
          <div className="h-0.5 flex-1 bg-border mx-2" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'shipping' ? 'text-accent' : step === 'payment' ? 'text-foreground' : 'text-muted-foreground'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">2</span>
            Entrega
          </div>
          <div className="h-0.5 flex-1 bg-border mx-2" />
          <div className={`flex items-center gap-2 text-xs font-bold ${step === 'payment' ? 'text-accent' : 'text-muted-foreground'}`}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">3</span>
            Pago
          </div>
        </div>
      </div>

      {/* Step 1: Contact */}
      {step === 'contact' && (
        <Card className="border border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Datos de contacto</h2>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setStep('shipping');
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre y apellido</Label>
                <Input
                  id="name"
                  required
                  autoComplete="name"
                  placeholder="Juan Pérez"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  inputMode="email"
                  autoComplete="email"
                  placeholder="juan.perez@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Te enviaremos el comprobante y el código de seguimiento aquí.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="phone">Teléfono celular (opcional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="11 1234 5678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Para notificaciones instantáneas de envío por WhatsApp.</p>
              </div>

              <Button type="submit" className="w-full gap-2 font-bold">
                Continuar a opción de entrega <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Shipping */}
      {step === 'shipping' && (
        <Card className="border border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Opción de entrega</h2>
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                setStep('payment');
              }}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ' +
                    (shippingMethod === 'pickup'
                      ? 'border-accent bg-accent/10 font-semibold'
                      : 'border-border bg-card hover:bg-secondary')
                  }
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={shippingMethod === 'pickup'}
                    onChange={() => setShippingMethod('pickup')}
                    className="sr-only"
                  />
                  <Store className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Retiro en local</p>
                    <p className="text-xs text-muted-foreground">Sin costo adicional</p>
                  </div>
                </label>

                <label
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ' +
                    (shippingMethod === 'delivery'
                      ? 'border-accent bg-accent/10 font-semibold'
                      : 'border-border bg-card hover:bg-secondary')
                  }
                >
                  <input
                    type="radio"
                    name="shippingMethod"
                    checked={shippingMethod === 'delivery'}
                    onChange={() => setShippingMethod('delivery')}
                    className="sr-only"
                  />
                  <Truck className="h-5 w-5 text-accent shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Envío a domicilio</p>
                    <p className="text-xs text-muted-foreground">A todo el país</p>
                  </div>
                </label>
              </div>

              {shippingMethod === 'delivery' && (
                <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <Label htmlFor="street">Calle</Label>
                      <Input
                        id="street"
                        required
                        autoComplete="address-line1"
                        placeholder="Av. Santa Fe"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        required
                        inputMode="numeric"
                        placeholder="1234"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="floor">Piso / Departamento (opcional)</Label>
                    <Input
                      id="floor"
                      autoComplete="address-line2"
                      placeholder="Piso 4 Dpto B"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="city">Ciudad / Localidad</Label>
                      <Input
                        id="city"
                        required
                        autoComplete="address-level2"
                        placeholder="Palermo / CABA"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="province">Provincia</Label>
                      <Input
                        id="province"
                        required
                        autoComplete="address-level1"
                        placeholder="Buenos Aires"
                        value={province}
                        onChange={(e) => setProvince(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="postalCode">Código Postal</Label>
                    <Input
                      id="postalCode"
                      required
                      autoComplete="postal-code"
                      placeholder="C1425"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="shippingNotes">Instrucciones de entrega (opcional)</Label>
                    <Input
                      id="shippingNotes"
                      placeholder="Ej: Dejar en portería de 9 a 18 hs"
                      value={shippingNotes}
                      onChange={(e) => setShippingNotes(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" className="w-1/3" onClick={() => setStep('contact')}>
                  Volver
                </Button>
                <Button type="submit" className="w-2/3 gap-2 font-bold">
                  Continuar al pago <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Payment */}
      {step === 'payment' && plan && (
        <Card className="border border-border">
          <CardContent className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground">Resumen y Forma de Pago</h2>

            {/* Payment Summary Box */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal del carrito</span>
                <span className="font-semibold">{formatCentsAsArs(plan.subtotalCents)}</span>
              </div>

              {plan.plan === 'DEPOSIT_BALANCE' ? (
                <>
                  <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border">
                    <span>Seña a abonar hoy (50%)</span>
                    <span className="text-accent">{formatCentsAsArs(plan.dueTodayCents)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Saldo restante (al llegar a Arg)</span>
                    <span>{formatCentsAsArs(plan.balanceCents ?? 0)}</span>
                  </div>
                  <p className="pt-2 text-[11px] text-muted-foreground leading-relaxed">
                    El costo de envío se calculará y abonará junto con el saldo cuando recibamos el lote en nuestro depósito.
                  </p>
                </>
              ) : (
                <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border">
                  <span>Total a abonar hoy</span>
                  <span>{formatCentsAsArs(plan.dueTodayCents)}</span>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-3">
              <span className="text-sm font-semibold text-foreground">Seleccioná cómo abonar</span>

              {/* Sólo se ofrecen los métodos que el backend tiene realmente
                  configurados: la pasarela de tarjeta se elige desde el servidor. */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {enabledMethods.map((method) => {
                  const Icon = method === 'bank_transfer' ? Landmark : CreditCard;
                  return (
                    <label
                      key={method}
                      className={
                        'flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-all ' +
                        (paymentMethod === method
                          ? 'border-accent bg-accent/10 font-semibold'
                          : 'border-border bg-card hover:bg-secondary')
                      }
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={paymentMethod === method}
                        onChange={() => setPaymentMethod(method)}
                        className="sr-only"
                      />
                      <Icon className="h-5 w-5 text-accent shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-foreground">{PAYMENT_METHOD_LABELS[method]}</p>
                        <p className="text-xs text-muted-foreground">
                          {method === 'bank_transfer' ? 'CBU / Alias bancario' : 'Débito, crédito y cuotas'}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notas o aclaraciones para el pedido (opcional)</Label>
              <Input
                id="notes"
                placeholder="Ej: Avisar por WhatsApp antes de enviar"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {submitError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {submitError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="w-1/3" onClick={() => setStep('shipping')}>
                Volver
              </Button>
              <Button
                type="button"
                className="w-2/3 gap-2 font-bold"
                disabled={isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting ? (
                  'Procesando pedido…'
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Confirmar Pedido
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
