'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tienda/ui';
import {
  Ticket,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Percent,
  DollarSign,
  Truck,
} from 'lucide-react';
import { formatCentsAsArs } from '@tienda/shared';
import { useApi } from '@/lib/use-api';
import { ApiError } from '@/lib/api';

interface Coupon {
  id: string;
  code: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';
  value: number;
  minPurchaseCents: number;
  maxUses: number | null;
  uses: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { orders: number };
}

type Mode = 'list' | 'create' | 'edit';

const TYPE_LABELS: Record<string, string> = {
  PERCENTAGE: 'Porcentaje',
  FIXED_AMOUNT: 'Monto fijo',
  FREE_SHIPPING: 'Envío gratis',
};

const TYPE_ICONS: Record<string, typeof Percent> = {
  PERCENTAGE: Percent,
  FIXED_AMOUNT: DollarSign,
  FREE_SHIPPING: Truck,
};

export default function CouponsPage() {
  const api = useApi();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('list');
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING'>('PERCENTAGE');
  const [value, setValue] = useState('');
  const [minPurchaseCents, setMinPurchaseCents] = useState('0');
  const [maxUses, setMaxUses] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: () => api<Coupon[]>('/admin/coupons'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        code,
        type,
        value: Number(value),
        minPurchaseCents: Number(minPurchaseCents),
        maxUses: maxUses ? Number(maxUses) : null,
        expiresAt: expiresAt || null,
        isActive,
      };

      return mode === 'edit' && editingCoupon
        ? api(`/admin/coupons/${editingCoupon.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : api('/admin/coupons', { method: 'POST', body: JSON.stringify(body) });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
      resetForm();
      setMode('list');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'No se pudo guardar el cupón'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/coupons/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });

  const openCreate = () => {
    resetForm();
    setMode('create');
  };

  const openEdit = (coupon: Coupon) => {
    setError(null);
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setType(coupon.type);
    setValue(String(coupon.value));
    setMinPurchaseCents(String(coupon.minPurchaseCents));
    setMaxUses(coupon.maxUses !== null ? String(coupon.maxUses) : '');
    setExpiresAt(coupon.expiresAt ? coupon.expiresAt.slice(0, 16) : '');
    setIsActive(coupon.isActive);
    setMode('edit');
  };

  const handleDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este cupón?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setCode('');
    setType('PERCENTAGE');
    setValue('');
    setMinPurchaseCents('0');
    setMaxUses('');
    setExpiresAt('');
    setIsActive(true);
    setEditingCoupon(null);
    setError(null);
  };

  const formatValue = (coupon: Coupon) => {
    switch (coupon.type) {
      case 'PERCENTAGE':
        return `${coupon.value}%`;
      case 'FIXED_AMOUNT':
        return formatCentsAsArs(coupon.value);
      case 'FREE_SHIPPING':
        return 'Envío gratis';
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground animate-pulse">Cargando cupones...</p>;
  }

  return (
    <div className="space-y-6">
      {mode === 'list' ? (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Cupones de Descuento</h1>
              <p className="text-sm text-muted-foreground">
                Administrá los cupones y códigos de descuento de la tienda.
              </p>
            </div>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Cupón
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descuento</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Mín. Compra</TableHead>
                  <TableHead className="w-32">Estado</TableHead>
                  <TableHead className="w-24 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons && coupons.length > 0 ? (
                  coupons.map((coupon) => {
                    const TypeIcon = TYPE_ICONS[coupon.type] || Ticket;
                    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < new Date();
                    const usedUp = coupon.maxUses !== null && coupon.uses >= coupon.maxUses;

                    return (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-mono font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-primary" />
                            {coupon.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <TypeIcon className="h-3.5 w-3.5" />
                            {TYPE_LABELS[coupon.type]}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {formatValue(coupon)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {coupon.uses}{coupon.maxUses !== null ? ` / ${coupon.maxUses}` : ''}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {coupon.minPurchaseCents > 0
                            ? formatCentsAsArs(coupon.minPurchaseCents)
                            : 'Sin mínimo'}
                        </TableCell>
                        <TableCell>
                          {isExpired ? (
                            <span className="text-xs font-semibold text-yellow-600">Expirado</span>
                          ) : usedUp ? (
                            <span className="text-xs font-semibold text-orange-600">Agotado</span>
                          ) : coupon.isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
                              <CheckCircle className="h-3.5 w-3.5" /> Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                              <XCircle className="h-3.5 w-3.5" /> Inactivo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(coupon)} className="h-8 w-8 p-0">
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(coupon.id)}
                              className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-sm text-muted-foreground">
                      No hay cupones creados todavía.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="mx-auto max-w-xl space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setMode('list')} className="h-9 w-9 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-bold">
              {mode === 'create' ? 'Crear Nuevo Cupón' : `Editar: ${editingCoupon?.code}`}
            </h1>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-border bg-background p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código del Cupón</Label>
              <Input
                id="code"
                type="text"
                placeholder="BIENVENIDO10"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                className="font-mono uppercase"
                required
              />
              <p className="text-xs text-muted-foreground">
                El cliente ingresará este código en el checkout. Sin espacios, se convierte a mayúsculas automáticamente.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo de Descuento</Label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full rounded-md border border-input bg-transparent h-10 px-3 text-sm focus:border-primary/50 focus:outline-none"
              >
                <option value="PERCENTAGE">Porcentaje (%)</option>
                <option value="FIXED_AMOUNT">Monto fijo (ARS)</option>
                <option value="FREE_SHIPPING">Envío gratis</option>
              </select>
            </div>

            {type !== 'FREE_SHIPPING' && (
              <div className="space-y-2">
                <Label htmlFor="value">
                  {type === 'PERCENTAGE' ? 'Porcentaje de descuento (%)' : 'Monto de descuento (centavos ARS)'}
                </Label>
                <Input
                  id="value"
                  type="number"
                  min={1}
                  placeholder={type === 'PERCENTAGE' ? '10' : '500000'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                />
                {type === 'FIXED_AMOUNT' && value && (
                  <p className="text-xs text-muted-foreground">
                    Equivale a {formatCentsAsArs(Number(value))} de descuento.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="minPurchase">Monto mínimo de compra (centavos ARS)</Label>
              <Input
                id="minPurchase"
                type="number"
                min={0}
                placeholder="0"
                value={minPurchaseCents}
                onChange={(e) => setMinPurchaseCents(e.target.value)}
              />
              {Number(minPurchaseCents) > 0 && (
                <p className="text-xs text-muted-foreground">
                  El cupón solo se aplica a compras mayores a {formatCentsAsArs(Number(minPurchaseCents))}.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Máximo de usos (vacío = ilimitado)</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min={1}
                  placeholder="Sin límite"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Fecha de expiración (opcional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary h-4 w-4"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-foreground select-none">
                Cupón activo y utilizable
              </label>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setMode('list')} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !code || (type !== 'FREE_SHIPPING' && !value)}
                className="flex-1 font-semibold"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Guardando...
                  </>
                ) : (
                  'Guardar Cupón'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
