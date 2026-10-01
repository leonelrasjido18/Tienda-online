'use client';

import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@tienda/ui';
import {
  applyPaymentDiscount,
  formatCentsAsArs,
  parseArsToCents,
  type PaymentDiscountConfig,
  type PaymentDiscountMode,
} from '@tienda/shared';
import { useQuery } from '@tanstack/react-query';

import { useApi } from '@/lib/use-api';

/**
 * Si la consulta falla, se muestra igual algo en pesos. Son valores de respaldo,
 * no los del catálogo: los reales vienen de `sample-prices`.
 */
const PRECIOS_RESPALDO = [5_000_000, 5_050_000, 5_350_000];

interface Props {
  label: string;
  value: PaymentDiscountConfig;
  onChange: (config: PaymentDiscountConfig) => void;
}

/** Editor del descuento de un medio de pago, con vista previa en pesos. */
export function DescuentoMedioPago({ label, value, onChange }: Props) {
  const api = useApi();
  const texto = value.mode === 'percentage' ? String(value.value) : (value.value / 100).toString();

  // Los precios más usados del catálogo hoy. Tenerlos fijos en el código hacía
  // que el ejemplo envejeciera apenas se ajustaban los precios.
  const { data: precios } = useQuery({
    queryKey: ['admin', 'pricing', 'sample-prices'],
    queryFn: () => api<number[]>('/admin/pricing/sample-prices'),
    staleTime: 5 * 60_000,
  });
  const ejemplos = precios && precios.length > 0 ? precios : PRECIOS_RESPALDO;

  function cambiarValor(entrada: string) {
    if (!entrada.trim()) {
      onChange({ ...value, value: 0 });
      return;
    }
    try {
      const nuevo =
        value.mode === 'percentage' ? Math.max(0, Math.trunc(Number(entrada))) : parseArsToCents(entrada);
      onChange({ ...value, value: Number.isFinite(nuevo) ? nuevo : 0 });
    } catch {
      // Mientras tipea puede quedar un valor a medias; se ignora hasta que sea válido.
    }
  }

  function cambiarModo(mode: PaymentDiscountMode) {
    // El número escrito no significa lo mismo en un modo que en el otro, así que
    // se vuelve a cero en vez de reinterpretarlo y cambiar el precio sin aviso.
    onChange({ mode, value: 0 });
  }

  const activo = value.value > 0;

  return (
    <div className="space-y-3 pl-6">
      <p className="text-xs font-medium text-muted-foreground">Descuento por pagar con {label}</p>

      <div className="flex flex-wrap gap-2">
        <div className="w-40 space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={value.mode} onValueChange={(v) => cambiarModo(v as PaymentDiscountMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Porcentaje</SelectItem>
              <SelectItem value="amount">Monto fijo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-40 space-y-1">
          <Label className="text-xs">{value.mode === 'percentage' ? 'Porcentaje (%)' : 'Monto (ARS)'}</Label>
          <Input inputMode="decimal" value={texto} onChange={(e) => cambiarValor(e.target.value)} placeholder="0" />
        </div>
      </div>

      {activo ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Cómo quedarían los precios</p>
          <ul className="space-y-1 text-sm">
            {ejemplos.map((precio) => (
              <li key={precio} className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground line-through">{formatCentsAsArs(precio)}</span>
                <span aria-hidden>→</span>
                <span className="font-semibold">{formatCentsAsArs(applyPaymentDiscount(precio, value))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Son los precios más usados de tu catálogo. Se aplica sobre el total después del cupón, si el
            cliente usó alguno.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">En cero no se ofrece descuento con este medio.</p>
      )}
    </div>
  );
}
