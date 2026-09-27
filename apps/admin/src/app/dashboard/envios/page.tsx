'use client';

import {
  Button,
  Input,
  Label,
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
  AR_PROVINCES,
  formatCentsAsArs,
  parseArsToCents,
  type ObservedShippingRateDto,
  type ShippingRateDto,
} from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function ShippingRatesPage() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [province, setProvince] = useState<string>(AR_PROVINCES[0]);
  const [priceText, setPriceText] = useState('');
  const [etaDays, setEtaDays] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: rates, isLoading } = useQuery({
    queryKey: ['admin', 'shipping-rates'],
    queryFn: () => api<ShippingRateDto[]>('/admin/shipping/rates'),
  });

  // Lo que se cobro de verdad en los pedidos ya despachados. Es la fuente para
  // armar la tabla con precios propios en vez de estimar.
  const { data: observed } = useQuery({
    queryKey: ['admin', 'shipping-observed'],
    queryFn: () => api<ObservedShippingRateDto[]>('/admin/shipping/rates/observed'),
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin', 'shipping-rates'] });

  const adoptMutation = useMutation({
    mutationFn: (row: ObservedShippingRateDto) =>
      api('/admin/shipping/rates', {
        method: 'PUT',
        body: JSON.stringify({ province: row.province, priceCents: row.avgCents, etaDays: null }),
      }),
    onSuccess: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      let priceCents: number;
      try {
        priceCents = parseArsToCents(priceText);
      } catch {
        throw new Error('invalid-price');
      }
      return api('/admin/shipping/rates', {
        method: 'PUT',
        body: JSON.stringify({
          province,
          priceCents,
          etaDays: etaDays ? Number(etaDays) : null,
          isActive: true,
        }),
      });
    },
    onSuccess: () => {
      setError(null);
      setPriceText('');
      setEtaDays('');
      invalidate();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'El precio tiene que ser un número.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/shipping/rates/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-semibold">Costos de envío</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Precio por provincia. Se usa para cotizar el envío cuando llega un lote y se le cobra el
        saldo al cliente. El retiro en el local siempre es gratis.
      </p>

      <div className="mt-6 rounded-lg border border-border bg-background p-4">
        <h2 className="mb-3 text-sm font-semibold">Agregar o actualizar</h2>
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px_120px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label>Provincia</Label>
            <Select value={province} onValueChange={setProvince}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AR_PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price">Precio (ARS)</Label>
            <Input
              id="price"
              required
              inputMode="decimal"
              placeholder="4500"
              value={priceText}
              onChange={(e) => setPriceText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eta">Días</Label>
            <Input
              id="eta"
              type="number"
              min={0}
              placeholder="3"
              value={etaDays}
              onChange={(e) => setEtaDays(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
          </Button>
        </form>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provincia</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Demora</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {rates?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Sin tarifas cargadas. Los envíos van a cotizar $0 hasta que agregues al menos una.
                </TableCell>
              </TableRow>
            )}
            {rates?.map((rate) => (
              <TableRow key={rate.id}>
                <TableCell className="font-medium">{rate.province}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatCentsAsArs(rate.priceCents)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {rate.etaDays !== null ? `${rate.etaDays} días` : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => {
                      if (confirm(`¿Eliminar la tarifa de ${rate.province}?`))
                        deleteMutation.mutate(rate.id);
                    }}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground">Lo que cobraste de verdad</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sale de los pedidos ya despachados: cada envío que cargás a mano afina este promedio.
          Sirve para reemplazar las estimaciones por tus precios reales.
        </p>

        {!observed || observed.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no hay envíos despachados con costo cargado. Después de los primeros pedidos vas
            a ver acá el precio real por provincia.
          </p>
        ) : (
          <div className="mt-4 rounded-lg border border-border bg-background">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provincia</TableHead>
                  <TableHead>Promedio</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead>Envíos</TableHead>
                  <TableHead>Prendas prom.</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {observed.map((row) => {
                  const cargada = rates?.find((r) => r.province === row.province);
                  return (
                    <TableRow key={row.province}>
                      <TableCell className="font-medium">{row.province}</TableCell>
                      <TableCell>{formatCentsAsArs(row.avgCents)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.minCents === row.maxCents
                          ? '—'
                          : `${formatCentsAsArs(row.minCents)} a ${formatCentsAsArs(row.maxCents)}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.samples}</TableCell>
                      <TableCell className="text-muted-foreground">{row.avgItems}</TableCell>
                      <TableCell className="text-right">
                        {cargada?.priceCents === row.avgCents ? (
                          <span className="text-xs text-muted-foreground">Ya es la tarifa</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={adoptMutation.isPending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Usar ${formatCentsAsArs(row.avgCents)} como tarifa de ${row.province}?` +
                                    ` (promedio de ${row.samples} envío/s)`,
                                )
                              ) {
                                adoptMutation.mutate(row);
                              }
                            }}
                          >
                            Usar promedio
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
