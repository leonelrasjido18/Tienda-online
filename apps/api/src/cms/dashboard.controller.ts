import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  /** Estadísticas generales del panel de administración. */
  @Get('stats')
  async getStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Pedidos totales y de últimos 30 días
    const [
      totalOrders,
      last30DaysOrders,
      revenueResult,
      last30Revenue,
      customersCount,
      lowStockVariants,
      preorderDemand,
      dailyRevenue,
      topSellers,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          financialStatus: { in: ['PAID', 'DEPOSIT_PAID'] },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: thirtyDaysAgo },
          financialStatus: { in: ['PAID', 'DEPOSIT_PAID'] },
        },
      }),
      this.prisma.customer.count(),
      // Variantes con stock crítico (<=3 unidades). El stock no vive en la variante
      // sino en InventoryItem (quantity/reserved); sólo cuentan las que trackean
      // inventario y cuyo producto está activo.
      this.prisma.inventoryItem.findMany({
        where: {
          trackInventory: true,
          quantity: { lte: 3 },
          // Solo camisetas que se venden con stock en el local (no las de solo
          // por encargo, que siempre están en 0 y no son una alerta real).
          variant: { product: { status: 'ACTIVE', fulfillmentMode: { in: ['IN_STOCK', 'BOTH'] } } },
        },
        select: {
          quantity: true,
          variant: {
            select: {
              id: true,
              sku: true,
              product: { select: { name: true } },
              optionValues: { select: { value: { select: { value: true } } } },
            },
          },
        },
        orderBy: { quantity: 'asc' },
        take: 15,
      }),
      // Demanda acumulada de preorders en los últimos 30 días
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true },
        where: {
          fulfillmentMode: 'PREORDER',
          order: { createdAt: { gte: thirtyDaysAgo } },
        },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
      // Ingresos diarios últimos 7 días
      this.prisma.$queryRaw`
        SELECT
          DATE(o."createdAt") as date,
          COUNT(*)::int as orders,
          COALESCE(SUM(o."totalCents"), 0)::bigint as revenue_cents
        FROM orders o
        WHERE o."createdAt" >= ${sevenDaysAgo}
          AND o."financialStatus" IN ('PAID', 'DEPOSIT_PAID')
        GROUP BY DATE(o."createdAt")
        ORDER BY date ASC
      ` as Promise<Array<{ date: string; orders: number; revenue_cents: bigint }>>,
      // Más vendidos: por cantidad de unidades en pedidos pagados (o con seña).
      this.prisma.orderItem.groupBy({
        by: ['productName'],
        _sum: { quantity: true, totalCents: true },
        where: { order: { financialStatus: { in: ['PAID', 'DEPOSIT_PAID'] } } },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const totalRevenueCents = revenueResult._sum.totalCents ?? 0;
    const last30RevenueCents = last30Revenue._sum.totalCents ?? 0;
    const avgTicketCents = last30DaysOrders > 0 ? Math.round(last30RevenueCents / last30DaysOrders) : 0;

    return {
      totalOrders,
      last30DaysOrders,
      totalRevenueCents,
      last30RevenueCents,
      avgTicketCents,
      customersCount,
      // El front espera { id, sku, stock, optionsLabel, product.title }; se arma
      // acá desde InventoryItem + las opciones de la variante.
      lowStockVariants: lowStockVariants.map((it) => ({
        id: it.variant.id,
        sku: it.variant.sku,
        stock: it.quantity,
        optionsLabel: it.variant.optionValues.map((ov) => ov.value.value).join(' / ') || null,
        product: { title: it.variant.product.name },
      })),
      preorderDemand,
      dailyRevenue: dailyRevenue.map((r) => ({
        date: r.date,
        orders: r.orders,
        revenueCents: Number(r.revenue_cents),
      })),
      topSellers: topSellers.map((t) => ({
        productName: t.productName,
        quantity: t._sum.quantity ?? 0,
        revenueCents: t._sum.totalCents ?? 0,
      })),
    };
  }
}
