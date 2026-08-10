'use client';

import { Button, Input, Label, Textarea } from '@tienda/ui';
import type { StoreSettingsDto, UpdateStoreSettingsInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

export default function SettingsPage() {
  const api = useApi();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api<StoreSettingsDto>('/admin/settings'),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  return <SettingsForm initial={data} />;
}

function SettingsForm({ initial }: { initial: StoreSettingsDto }) {
  const api = useApi();
  const queryClient = useQueryClient();

  const [depositPercentText, setDepositPercentText] = useState(initial.defaultDepositPercent.toString());
  const [bankTransferInstructions, setBankTransferInstructions] = useState(initial.bankTransferInstructions ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => {
      const defaultDepositPercent = Number(depositPercentText);
      if (!Number.isInteger(defaultDepositPercent) || defaultDepositPercent < 1 || defaultDepositPercent > 100) {
        throw new Error('invalid-percent');
      }
      const body: UpdateStoreSettingsInput = {
        defaultDepositPercent,
        bankTransferInstructions: bankTransferInstructions.trim() || null,
      };
      return api<StoreSettingsDto>('/admin/settings', { method: 'PATCH', body: JSON.stringify(body) });
    },
    onSuccess: (updated) => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      queryClient.setQueryData(['admin', 'settings'], updated);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'El porcentaje tiene que ser un número entero entre 1 y 100.');
    },
  });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Ajustes de la tienda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configuración general de pagos y envíos por transferencia.
      </p>

      <div className="mt-6 space-y-6 rounded-lg border border-border bg-background p-4">
        <div className="space-y-2">
          <Label htmlFor="depositPercent">Seña para pedidos por encargo (%)</Label>
          <Input
            id="depositPercent"
            type="number"
            min={1}
            max={100}
            value={depositPercentText}
            onChange={(e) => setDepositPercentText(e.target.value)}
            className="max-w-32"
          />
          <p className="text-xs text-muted-foreground">
            Porcentaje que se cobra al confirmar un pedido con productos por encargo. El saldo (el resto) se cobra
            cuando llega el pedido desde China.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bankTransferInstructions">Instrucciones de transferencia bancaria</Label>
          <Textarea
            id="bankTransferInstructions"
            rows={4}
            placeholder="CBU, alias, titular de la cuenta…"
            value={bankTransferInstructions}
            onChange={(e) => setBankTransferInstructions(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Se le muestra al cliente cuando elige pagar por transferencia, para que sepa a dónde transferir.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {saved && <p className="text-sm text-emerald-600">Guardado.</p>}

        <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Guardando…' : 'Guardar ajustes'}
        </Button>
      </div>
    </div>
  );
}
