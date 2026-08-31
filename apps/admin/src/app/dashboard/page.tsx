'use client';

import { useQuery } from '@tanstack/react-query';
import { formatCentsAsArs } from '@tienda/shared';
import {
  ShoppingBag,
  DollarSign,
  Users,
  TrendingUp,
  AlertTriangle,
  Package,
  BarChart3,
  Trophy,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useApi } from '@/lib/use-api';

interface LowStockVariant {
  id: string;
  sku: string;
  stock: number;
  optionsLabel: string | null;
  product: { title: string };
}

interface PreorderDemand {
  productName: string;
  _sum: { quantity: number };
}

interface DailyRevenue {
  date: string;
  orders: number;
  revenueCents: number;
}

interface TopSeller {
  productName: string;
  quantity: number;
  revenueCents: number;
}

interface DashboardStats {
  totalOrders: number;
  last30DaysOrders: number;
  totalRevenueCents: number;
  last30RevenueCents: number;
  avgTicketCents: number;
  customersCount: number;
  lowStockVariants: LowStockVariant[];
  preorderDemand: PreorderDemand[];
  dailyRevenue: DailyRevenue[];
  topSellers: TopSeller[];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const api = useApi();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: () => api<DashboardStats>('/admin/dashboard/stats'),
    refetchInterval: 60_000, // Refrescar cada minuto
  });

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground animate-pulse">Cargando estadísticas...</p>
      </div>
    );
  }

  const maxRevenue = Math.max(...stats.dailyRevenue.map((d) => d.revenueCents), 1);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Hola, {user?.name} 👋
        </h1>
        <p className="text-sm text-muted-foreground">
          Resumen de los últimos 30 días de la tienda.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          icon={ShoppingBag}
          label="Pedidos (30 días)"
          value={stats.last30DaysOrders.toString()}
          subValue={`${stats.totalOrders} totales`}
          color="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <KPICard
          icon={DollarSign}
          label="Facturación (30 días)"
          value={formatCentsAsArs(stats.last30RevenueCents)}
          subValue={`${formatCentsAsArs(stats.totalRevenueCents)} total`}
          color="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
        <KPICard
          icon={TrendingUp}
          label="Ticket Promedio"
          value={formatCentsAsArs(stats.avgTicketCents)}
          subValue="Últimos 30 días"
          color="text-violet-500"
          bgColor="bg-violet-500/10"
        />
        <KPICard
          icon={Users}
          label="Clientes Registrados"
          value={stats.customersCount.toString()}
          subValue="Total acumulado"
          color="text-amber-500"
          bgColor="bg-amber-500/10"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Ingresos Últimos 7 Días</h2>
          </div>

          {stats.dailyRevenue.length > 0 ? (
            <div className="flex items-end gap-2 h-48">
              {stats.dailyRevenue.map((day) => {
                const height = Math.max((day.revenueCents / maxRevenue) * 100, 4);
                const dateLabel = new Date(day.date).toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: 'numeric',
                });

                return (
                  <div key={day.date} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-[10px] font-semibold text-foreground">
                      {formatCentsAsArs(day.revenueCents)}
                    </span>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary/80 to-primary transition-all duration-500"
                      style={{ height: `${height}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground mt-1">{dateLabel}</span>
                    <span className="text-[10px] text-muted-foreground">{day.orders} ord.</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-12">
              No hay datos de ventas en los últimos 7 días.
            </p>
          )}
        </div>

        {/* Preorder Demand */}
        <div className="rounded-xl border border-border bg-background p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-foreground">Demanda de Por Encargo (30 días)</h2>
          </div>

          {stats.preorderDemand.length > 0 ? (
            <div className="space-y-3">
              {stats.preorderDemand.map((item, i) => {
                const maxDemand = stats.preorderDemand[0]?._sum.quantity ?? 1;
                const width = Math.max((item._sum.quantity / maxDemand) * 100, 8);

                return (
                  <div key={i} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground truncate max-w-[200px]">
                        {item.productName}
                      </span>
                      <span className="font-bold text-primary">{item._sum.quantity} uds.</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic text-center py-12">
              No hay demanda de productos por encargo registrada.
            </p>
          )}
        </div>
      </div>

      {/* Más Vendidos */}
      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          <h2 className="font-bold text-foreground">Más Vendidos</h2>
        </div>

        {stats.topSellers.length > 0 ? (
          <div className="space-y-2">
            {stats.topSellers.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-black ${
                  i === 0
                    ? 'bg-amber-500/20 text-amber-600'
                    : i === 1
                      ? 'bg-slate-400/20 text-slate-500'
                      : i === 2
                        ? 'bg-orange-700/20 text-orange-700'
                        : 'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <p className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">
                  {item.productName}
                </p>
                <span className="text-xs font-bold text-primary">{item.quantity} uds.</span>
                <span className="text-xs text-muted-foreground w-24 text-right">
                  {formatCentsAsArs(item.revenueCents)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-8">
            Todavía no hay ventas registradas.
          </p>
        )}
      </div>

      {/* Low Stock Alerts */}
      <div className="rounded-xl border border-border bg-background p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          <h2 className="font-bold text-foreground">Alertas de Stock Crítico</h2>
          {stats.lowStockVariants.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-500/10 text-yellow-600">
              {stats.lowStockVariants.length} variantes
            </span>
          )}
        </div>

        {stats.lowStockVariants.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.lowStockVariants.map((variant) => (
              <div
                key={variant.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black ${
                  variant.stock === 0
                    ? 'bg-red-500/10 text-red-500'
                    : 'bg-yellow-500/10 text-yellow-600'
                }`}>
                  {variant.stock}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {variant.product.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {variant.optionsLabel || variant.sku}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic text-center py-6">
            🎉 No hay variantes con stock crítico. ¡Todo bien por ahora!
          </p>
        )}
      </div>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  bgColor,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  subValue: string;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
      </div>
    </div>
  );
}
