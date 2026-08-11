'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  ShoppingBag,
  Gift,
  MapPin,
  Loader2,
  LogOut,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle,
  Clock,
  Truck,
  PackageCheck,
  Ship,
  FileCheck
} from 'lucide-react';
import { Button, Input, Label, Card, CardContent } from '@tienda/ui';
import { clientFetch } from '@/lib/client-api';
import { formatCentsAsArs } from '@tienda/shared';

// Formato de provincia compatible
const PROVINCES = [
  'Buenos Aires', 'Capital Federal', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán'
];

type Tab = 'profile' | 'orders' | 'referrals';

interface CustomerProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  defaultPickupInStore: boolean;
  defaultStreet: string | null;
  defaultNumber: string | null;
  defaultFloor: string | null;
  defaultCity: string | null;
  defaultProvince: string | null;
  defaultPostalCode: string | null;
  defaultNotes: string | null;
  referralCode: string | null;
  referralBalanceCents: number;
}

interface OrderItem {
  id: string;
  productName: string;
  variantSku: string;
  optionsLabel: string | null;
  imageUrl: string | null;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
  fulfillmentMode: 'IN_STOCK' | 'PREORDER';
}

interface ImportBatch {
  id: string;
  code: string;
  status: 'OPEN' | 'ORDERED' | 'IN_TRANSIT' | 'CUSTOMS' | 'RECEIVED' | 'CLOSED';
  etaDate: string | null;
}

interface Order {
  id: string;
  number: number;
  publicToken: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  pickupInStore: boolean;
  shippingStreet: string | null;
  shippingNumber: string | null;
  shippingFloor: string | null;
  shippingCity: string | null;
  shippingProvince: string | null;
  shippingPostalCode: string | null;
  paymentPlan: 'FULL' | 'DEPOSIT_BALANCE';
  financialStatus: 'PENDING' | 'DEPOSIT_PAID' | 'AWAITING_BALANCE' | 'PAID' | 'REFUNDED' | 'FAILED' | 'EXPIRED';
  fulfillmentStatus: 'UNFULFILLED' | 'AWAITING_IMPORT' | 'READY' | 'FULFILLED' | 'CANCELLED';
  subtotalCents: number;
  depositCents: number | null;
  balanceCents: number | null;
  shippingCents: number | null;
  totalCents: number;
  discountCents: number;
  createdAt: string;
  items: OrderItem[];
  importBatch: ImportBatch | null;
}

export default function MyAccountPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('orders');
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Estados del Formulario de Perfil
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [pickupInStore, setPickupInStore] = useState(false);
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [floor, setFloor] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [notes, setNotes] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // El fetch va dentro del effect (no en un useCallback aparte) y sólo toca estado
  // después de un await, para no disparar setState síncrono al montar. El flag
  // `cancelled` evita escribir en un componente ya desmontado. `isLoading` arranca
  // en true, así que no hace falta volver a marcarlo acá.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Perfil
        const { customer: profileData } = await clientFetch<{ customer: CustomerProfile }>('/customers/auth/me');
        if (cancelled) return;
        setCustomer(profileData);
        setProfileName(profileData.name || '');
        setProfilePhone(profileData.phone || '');
        setPickupInStore(profileData.defaultPickupInStore);
        setStreet(profileData.defaultStreet || '');
        setNumber(profileData.defaultNumber || '');
        setFloor(profileData.defaultFloor || '');
        setCity(profileData.defaultCity || '');
        setProvince(profileData.defaultProvince || '');
        setPostalCode(profileData.defaultPostalCode || '');
        setNotes(profileData.defaultNotes || '');

        // Pedidos del cliente
        const { orders: ordersData } = await clientFetch<{ orders: Order[] }>('/customers/auth/me/orders');
        if (cancelled) return;
        setOrders(ordersData);
      } catch {
        // Si falla la autenticación, al login
        if (!cancelled) router.push('/login?redirect=/mi-cuenta');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setUpdateSuccess(false);

    try {
      const { customer: updatedCustomer } = await clientFetch<{ customer: CustomerProfile }>('/customers/auth/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileName,
          phone: profilePhone,
          defaultPickupInStore: pickupInStore,
          defaultStreet: street,
          defaultNumber: number,
          defaultFloor: floor,
          defaultCity: city,
          defaultProvince: province,
          defaultPostalCode: postalCode,
          defaultNotes: notes,
        }),
      });

      setCustomer(updatedCustomer);
      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clientFetch('/customers/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (err) {
      console.error('Error logout:', err);
    }
  };

  const toggleOrderExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const handleCopyReferral = () => {
    if (!customer?.referralCode) return;
    const link = `${window.location.origin}/login?ref=${customer.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  // Renderizador de línea de tiempo de importación/entrega
  const renderOrderTimeline = (order: Order) => {
    const isPreorder = order.items.some((item) => item.fulfillmentMode === 'PREORDER');
    const batch = order.importBatch;

    if (!isPreorder) {
      // Pedido En Stock Simple
      const steps = [
        { label: 'Pedido Realizado', done: true, icon: FileCheck },
        { label: 'Preparando Envío', done: order.fulfillmentStatus !== 'UNFULFILLED', icon: Clock },
        { label: 'Despachado', done: ['READY', 'FULFILLED'].includes(order.fulfillmentStatus), icon: Truck },
        { label: 'Entregado', done: order.fulfillmentStatus === 'FULFILLED', icon: PackageCheck }
      ];

      return (
        <div className="mt-6 border-t border-border/50 pt-6">
          <h4 className="text-sm font-semibold mb-4 text-foreground">Estado del Envío (Producto en Stock)</h4>
          <div className="grid grid-cols-4 gap-2 relative">
            <div className="absolute top-1/2 left-[12%] right-[12%] h-[2px] bg-border/50 -translate-y-1/2 z-0" />
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className="flex flex-col items-center text-center relative z-10">
                  <div className={`p-2 rounded-full border-2 ${step.done ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium mt-2">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Pedido por Encargo (China Import)
    // Estados del lote: OPEN, ORDERED, IN_TRANSIT, CUSTOMS, RECEIVED, CLOSED
    const batchStatus = batch?.status || 'OPEN';

    const preorderSteps = [
      { label: 'Pedido Confirmado', done: true, icon: FileCheck },
      { label: 'Producción / Tránsito (China)', done: ['ORDERED', 'IN_TRANSIT', 'CUSTOMS', 'RECEIVED', 'CLOSED'].includes(batchStatus), icon: Ship },
      { label: 'Aduana Argentina', done: ['CUSTOMS', 'RECEIVED', 'CLOSED'].includes(batchStatus), icon: Clock },
      { label: 'En Depósito (Listo)', done: ['RECEIVED', 'CLOSED'].includes(batchStatus), icon: PackageCheck }
    ];

    return (
      <div className="mt-6 border-t border-border/50 pt-6">
        <h4 className="text-sm font-semibold mb-4 text-foreground flex items-center justify-between">
          <span>Línea de tiempo de Importación (Por Encargo)</span>
          {batch && (
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
              Lote: {batch.code}
            </span>
          )}
        </h4>
        <div className="grid grid-cols-4 gap-2 relative">
          <div className="absolute top-1/2 left-[12%] right-[12%] h-[2px] bg-border/50 -translate-y-1/2 z-0" />
          {preorderSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="flex flex-col items-center text-center relative z-10">
                <div className={`p-2 rounded-full border-2 ${step.done ? 'bg-primary border-primary text-primary-foreground' : 'bg-background border-border text-muted-foreground'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium mt-2">{step.label}</span>
              </div>
            );
          })}
        </div>
        {batch?.etaDate && (
          <p className="text-xs text-muted-foreground mt-4 text-center italic">
            Llegada estimada a depósito: {new Date(batch.etaDate).toLocaleDateString('es-AR', { dateStyle: 'long' })}
          </p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground text-sm">Cargando tu cuenta…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Cabecera del Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-border/60">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Mi Cuenta</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hola, <span className="font-semibold text-foreground">{customer?.name || customer?.email}</span> — Gestioná tu perfil, pedidos y referidos
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="mt-4 md:mt-0 flex items-center justify-center text-sm font-medium text-destructive hover:underline"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Barra Lateral Navegación */}
        <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 border-b lg:border-b-0 lg:border-r border-border/50 lg:pr-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${activeTab === 'orders' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <ShoppingBag className="h-4 w-4" />
            Mis Pedidos
            {orders.length > 0 && (
              <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${activeTab === 'orders' ? 'bg-primary-foreground text-primary' : 'bg-muted text-foreground'}`}>
                {orders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${activeTab === 'profile' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <User className="h-4 w-4" />
            Mi Perfil / Envío
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 ${activeTab === 'referrals' ? 'bg-primary text-primary-foreground shadow-md' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Gift className="h-4 w-4" />
            Programa de Referidos
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="lg:col-span-3">
          {/* TAB PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" /> Historial de Pedidos
              </h2>

              {orders.length === 0 ? (
                <Card className="border-dashed border-2 py-12 text-center">
                  <CardContent className="flex flex-col items-center">
                    <ShoppingBag className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
                    <p className="text-foreground font-semibold">Todavía no realizaste ninguna compra</p>
                    <p className="text-muted-foreground text-xs mt-1">Visitá nuestro catálogo para hacer tu primer pedido.</p>
                  </CardContent>
                </Card>
              ) : (
                orders.map((order) => {
                  const isExpanded = !!expandedOrders[order.id];
                  const orderDate = new Date(order.createdAt).toLocaleDateString('es-AR');
                  
                  return (
                    <Card key={order.id} className="overflow-hidden border-border/50 shadow-sm hover:shadow-md transition-shadow">
                      <div
                        onClick={() => toggleOrderExpand(order.id)}
                        className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold text-foreground">
                            Pedido #{order.number + 1000}
                          </span>
                          <span className="text-xs text-muted-foreground">{orderDate}</span>
                        </div>

                        <div className="flex items-center gap-3">
                          {/* Etiquetas de Estado */}
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            order.financialStatus === 'PAID' ? 'bg-green-500/10 text-green-500' :
                            order.financialStatus === 'DEPOSIT_PAID' ? 'bg-blue-500/10 text-blue-500' :
                            'bg-yellow-500/10 text-yellow-500'
                          }`}>
                            {order.financialStatus === 'PAID' ? 'Abonado' :
                             order.financialStatus === 'DEPOSIT_PAID' ? 'Señado (50%)' :
                             'Pendiente'}
                          </span>

                          <span className="text-sm font-extrabold text-foreground">
                            {formatCentsAsArs(order.totalCents)}
                          </span>

                          {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                        </div>
                      </div>

                      {/* Expansión del Pedido */}
                      {isExpanded && (
                        <div className="p-4 sm:p-5 border-t border-border/50 bg-muted/5">
                          {/* Productos */}
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Items</h4>
                            {order.items.map((item) => (
                              <div key={item.id} className="flex gap-4 items-start">
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt={item.productName}
                                    className="w-12 h-12 rounded-lg object-cover bg-muted"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
                                    SKU
                                  </div>
                                )}
                                <div className="flex-1 flex flex-col">
                                  <span className="text-sm font-semibold text-foreground">{item.productName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.optionsLabel ? `${item.optionsLabel} | ` : ''}Cantidad: {item.quantity}
                                  </span>
                                </div>
                                <span className="text-sm font-semibold text-foreground">
                                  {formatCentsAsArs(item.totalCents)}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Línea de tiempo de importación/envío */}
                          {renderOrderTimeline(order)}

                          {/* Desglose Financiero */}
                          <div className="mt-6 border-t border-border/50 pt-4 flex flex-col gap-2 text-sm">
                            <div className="flex justify-between text-muted-foreground">
                              <span>Subtotal</span>
                              <span>{formatCentsAsArs(order.subtotalCents)}</span>
                            </div>
                            {order.discountCents > 0 && (
                              <div className="flex justify-between text-green-600 font-medium">
                                <span>Descuento</span>
                                <span>-{formatCentsAsArs(order.discountCents)}</span>
                              </div>
                            )}
                            {order.shippingCents !== null && (
                              <div className="flex justify-between text-muted-foreground">
                                <span>Envío</span>
                                <span>{formatCentsAsArs(order.shippingCents)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-foreground text-base border-t border-border/30 pt-2">
                              <span>Total</span>
                              <span>{formatCentsAsArs(order.totalCents)}</span>
                            </div>
                          </div>

                          {/* Enlaces de Reintento / Pago de Saldo */}
                          {order.financialStatus === 'PENDING' && (
                            <div className="mt-6">
                              <Button
                                onClick={() => router.push(`/pedido/${order.publicToken}`)}
                                className="w-full h-10 text-sm font-semibold"
                              >
                                Pagar Seña / Continuar Pago
                              </Button>
                            </div>
                          )}
                          {order.financialStatus === 'DEPOSIT_PAID' && order.importBatch?.status === 'RECEIVED' && (
                            <div className="mt-6">
                              <Button
                                onClick={() => router.push(`/saldo/${order.publicToken}`)}
                                className="w-full h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700"
                              >
                                Pagar Saldo Pendiente y Envío
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          )}

          {/* TAB PERFIL */}
          {activeTab === 'profile' && (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-6 text-foreground flex items-center gap-2">
                  <User className="h-5 w-5" /> Datos de Contacto y Envío por Defecto
                </h2>

                {updateSuccess && (
                  <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-sm font-semibold text-center flex items-center justify-center gap-2 animate-bounce">
                    <CheckCircle className="h-4 w-4" /> Perfil guardado con éxito. Tus compras serán más rápidas ahora.
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-6">
                  {/* Datos Básicos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Leo Messi"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        disabled={isUpdating}
                        className="bg-background/50 h-10"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Número de Teléfono</Label>
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="+54 11 2345 6789"
                        value={profilePhone}
                        onChange={(e) => setProfilePhone(e.target.value)}
                        disabled={isUpdating}
                        className="bg-background/50 h-10"
                      />
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-4">
                    <h3 className="text-sm font-semibold mb-4 text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4" /> Dirección de Entrega por Defecto
                    </h3>

                    {/* Checkbox Retiro */}
                    <div className="flex items-center gap-2 mb-4">
                      <input
                        type="checkbox"
                        id="pickup"
                        checked={pickupInStore}
                        onChange={(e) => setPickupInStore(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <label htmlFor="pickup" className="text-sm font-medium text-foreground select-none">
                        Prefiero retirar en local / show room por defecto
                      </label>
                    </div>

                    {!pickupInStore && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="street">Calle</Label>
                            <Input
                              id="street"
                              type="text"
                              value={street}
                              onChange={(e) => setStreet(e.target.value)}
                              disabled={isUpdating}
                              className="bg-background/50 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="number">Número</Label>
                            <Input
                              id="number"
                              type="text"
                              value={number}
                              onChange={(e) => setNumber(e.target.value)}
                              disabled={isUpdating}
                              className="bg-background/50 h-10"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="floor">Piso / Depto (Opcional)</Label>
                            <Input
                              id="floor"
                              type="text"
                              value={floor}
                              onChange={(e) => setFloor(e.target.value)}
                              disabled={isUpdating}
                              className="bg-background/50 h-10"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="city">Ciudad</Label>
                            <Input
                              id="city"
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              disabled={isUpdating}
                              className="bg-background/50 h-10"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="province">Provincia</Label>
                            <select
                              id="province"
                              value={province}
                              onChange={(e) => setProvince(e.target.value)}
                              disabled={isUpdating}
                              className="w-full rounded-md border border-border/80 bg-background/50 h-10 px-3 text-sm focus:border-primary/50 focus:outline-none"
                            >
                              <option value="">Selecciona una provincia</option>
                              {PROVINCES.map((p) => (
                                <option key={p} value={p}>
                                  {p}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="postalCode">Código Postal</Label>
                            <Input
                              id="postalCode"
                              type="text"
                              value={postalCode}
                              onChange={(e) => setPostalCode(e.target.value)}
                              disabled={isUpdating}
                              className="bg-background/50 h-10"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="notes">Indicaciones de Envío</Label>
                          <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            disabled={isUpdating}
                            className="w-full min-h-[80px] rounded-md border border-border/80 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
                            placeholder="Dejar en portería, reja negra, tocar timbre, etc."
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Button type="submit" disabled={isUpdating} className="w-full h-11 text-base font-semibold">
                    {isUpdating ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando Cambios...
                      </>
                    ) : (
                      'Guardar Datos de Perfil'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          {/* TAB REFERIDOS */}
          {activeTab === 'referrals' && (
            <Card className="border-border/50 shadow-sm relative overflow-hidden">
              {/* Overlay decorativo de regalo */}
              <div className="absolute -right-8 -top-8 text-primary/5 pointer-events-none">
                <Gift className="w-48 h-48 rotate-12" />
              </div>

              <CardContent className="p-6 relative z-10">
                <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
                  <Gift className="h-5 w-5 text-primary" /> Programa de Referidos
                </h2>

                {/* Banner acumulado */}
                <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-wide uppercase opacity-90">Mi Saldo Acumulado</p>
                    <p className="text-3xl sm:text-4xl font-black mt-1">
                      {formatCentsAsArs(customer?.referralBalanceCents || 0)}
                    </p>
                  </div>
                  <Gift className="h-10 sm:h-12 w-10 sm:w-12 animate-pulse" />
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-foreground">Tu Link Único de Invitación</Label>
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        readOnly
                        value={customer?.referralCode ? `${window.location.origin}/login?ref=${customer.referralCode}` : 'Cargando link...'}
                        className="bg-muted border-border/60 text-sm font-mono h-11 flex-1"
                      />
                      <Button
                        onClick={handleCopyReferral}
                        className="h-11 px-4 flex items-center justify-center shrink-0"
                      >
                        {copiedReferral ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-border/50 pt-6 space-y-4">
                    <h3 className="text-sm font-bold text-foreground">¿Cómo funciona?</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                      <div className="flex flex-col gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">1</div>
                        <p className="font-semibold">Comparte tu link</p>
                        <p className="text-muted-foreground text-xs">Copia el link de invitación y compartilo con amigos, familia o en redes sociales.</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">2</div>
                        <p className="font-semibold">Tu amigo compra</p>
                        <p className="text-muted-foreground text-xs">Cuando tu amigo inicie sesión y realice su primera compra (ya sea en stock o por encargo).</p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">3</div>
                        <p className="font-semibold">¡Ganás $1000 ARS!</p>
                        <p className="text-muted-foreground text-xs">Una vez que su pedido se confirme, se te acreditarán $1000 ARS para descontar de tu próximo pedido.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
