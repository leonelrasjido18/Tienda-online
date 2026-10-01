'use client';

import {
  Badge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import {
  formatCentsAsArs,
  ORDER_FINANCIAL_STATUSES,
  type OrderFinancialStatus,
  type OrderSummaryDto,
} from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { useApi } from '@/lib/use-api';
import { OrderPreviewDialog } from './order-preview-dialog';

interface OrderListResponse {
  items: OrderSummaryDto[];
  total: number;
}

const FINANCIAL_STATUS_LABELS: Record<OrderFinancialStatus, string> = {
  PENDING: 'Pendiente',
  DEPOSIT_PAID: 'Seña pagada',
  AWAITING_BALANCE: 'Espera saldo',
  PAID: 'Pagado',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  REFUNDED: 'Reembolsado',
  FAILED: 'Fallido',
  EXPIRED: 'Expirado',
};

const FINANCIAL_STATUS_VARIANT: Record<OrderFinancialStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING: 'outline',
  DEPOSIT_PAID: 'secondary',
  AWAITING_BALANCE: 'secondary',
  PAID: 'default',
  PARTIALLY_REFUNDED: 'destructive',
  REFUNDED: 'destructive',
  FAILED: 'destructive',
  EXPIRED: 'destructive',
};

export default function OrdersPage() {
  const api = useApi();
  const [q, setQ] = useState('');
  const [financialStatus, setFinancialStatus] = useState<OrderFinancialStatus | 'ALL'>('ALL');
  // Vista rápida sin salir del listado: el detalle completo sigue en /pedidos/[id].
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'orders', q, financialStatus],
    queryFn: () =>
      api<OrderListResponse>(
        `/admin/orders?${new URLSearchParams({
          ...(q ? { q } : {}),
          ...(financialStatus !== 'ALL' ? { financialStatus } : {}),
        }).toString()}`,
      ),
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Pedidos</h1>
        <p className="text-sm text-muted-foreground">Ventas y pedidos por encargo.</p>
      </div>

      <div className="mb-4 flex max-w-lg gap-2">
        <Input placeholder="Buscar por nombre o email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={financialStatus} onValueChange={(v) => setFinancialStatus(v as OrderFinancialStatus | 'ALL')}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos los estados</SelectItem>
            {ORDER_FINANCIAL_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {FINANCIAL_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Estado de pago</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Ver detalle</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Todavía no hay pedidos.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <Link href={`/dashboard/pedidos/${order.id}`} className="font-medium hover:underline">
                    {order.displayNumber}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>{order.contactName}</div>
                  <div className="text-xs text-muted-foreground">{order.contactEmail}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {order.paymentPlan === 'FULL' ? 'Pago total' : 'Seña + saldo'}
                </TableCell>
                <TableCell>
                  <Badge variant={FINANCIAL_STATUS_VARIANT[order.financialStatus]}>
                    {FINANCIAL_STATUS_LABELS[order.financialStatus]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatCentsAsArs(order.totalCents)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(order.createdAt).toLocaleDateString('es-AR')}
                </TableCell>
                <TableCell className="text-right">
                  <button
                    type="button"
                    onClick={() => setVistaPrevia(order.id)}
                    title="Ver cliente y productos"
                    aria-label={`Ver el pedido ${order.displayNumber}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <OrderPreviewDialog orderId={vistaPrevia} onClose={() => setVistaPrevia(null)} />
    </div>
  );
}
