'use client';

import { Button, Input, Label, Textarea } from '@tienda/ui';
import type { StoreSettingsDto, UpdateStoreSettingsInput } from '@tienda/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { DescuentoMedioPago } from './descuento-medio-pago';

import { ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';

type Tab = 'generales' | 'cobros' | 'seguridad';

const TABS: { id: Tab; label: string }[] = [
  { id: 'generales', label: 'Generales' },
  { id: 'cobros', label: 'Cobros' },
  { id: 'seguridad', label: 'Seguridad' },
];

export default function SettingsPage() {
  const api = useApi();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api<StoreSettingsDto>('/admin/settings'),
  });

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  return <SettingsTabs initial={data} />;
}

function SettingsTabs({ initial }: { initial: StoreSettingsDto }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('generales');

  // Generales
  const [depositPercentText, setDepositPercentText] = useState(initial.defaultDepositPercent.toString());
  const [contactEmail, setContactEmail] = useState(initial.contactEmail ?? '');
  const [whatsappPhone, setWhatsappPhone] = useState(initial.whatsappPhone ?? '');
  const [whatsappMessage, setWhatsappMessage] = useState(initial.whatsappMessage ?? '');
  const [instagramUser, setInstagramUser] = useState(initial.instagramUser ?? '');
  const [pickupAddress, setPickupAddress] = useState(initial.pickupAddress ?? '');
  const [openingHours, setOpeningHours] = useState(initial.openingHours ?? '');
  // Cobros
  const [enableBankTransfer, setEnableBankTransfer] = useState(initial.enableBankTransfer);
  const [bankTransferInstructions, setBankTransferInstructions] = useState(initial.bankTransferInstructions ?? '');
  const [enableCardPayment, setEnableCardPayment] = useState(initial.enableCardPayment);
  const [enableCash, setEnableCash] = useState(initial.enableCash);
  const [bankTransferDiscount, setBankTransferDiscount] = useState(
    initial.bankTransferDiscount ?? { mode: 'percentage' as const, value: 0 },
  );
  const [cashDiscount, setCashDiscount] = useState(
    initial.cashDiscount ?? { mode: 'percentage' as const, value: 0 },
  );

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
        contactEmail: contactEmail.trim() || null,
        whatsappPhone: whatsappPhone.trim() || null,
        whatsappMessage: whatsappMessage.trim() || null,
        instagramUser: instagramUser.trim() || null,
        pickupAddress: pickupAddress.trim() || null,
        openingHours: openingHours.trim() || null,
        bankTransferInstructions: bankTransferInstructions.trim() || null,
        enableBankTransfer,
        enableCardPayment,
        enableCash,
        bankTransferDiscount,
        cashDiscount,
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
      setError(err instanceof ApiError ? err.message : 'Revisá los datos: la seña debe ser un número entre 1 y 100.');
    },
  });

  const save = (
    <div className="flex items-center gap-3 pt-2">
      <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saveMutation.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-600">Guardado.</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Ajustes de la tienda</h1>

      <div className="mt-4 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              'border-b-2 px-4 py-2 text-sm font-medium ' +
              (tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground')
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5 rounded-lg border border-border bg-background p-4">
        {tab === 'generales' && (
          <>
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
                Porcentaje que se cobra al confirmar un pedido por encargo. El saldo se cobra cuando llega el lote.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email de contacto</Label>
              <Input id="contactEmail" type="email" placeholder="contacto@remerasdelarea.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="whatsappPhone">WhatsApp</Label>
                <Input id="whatsappPhone" placeholder="+54 9 11 …" value={whatsappPhone} onChange={(e) => setWhatsappPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instagramUser">Instagram</Label>
                <Input id="instagramUser" placeholder="remerasdelarea" value={instagramUser} onChange={(e) => setInstagramUser(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappMessage">Mensaje de WhatsApp por defecto</Label>
              <Input id="whatsappMessage" placeholder="Hola! Quiero consultar por…" value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pickupAddress">Dirección de retiro en local</Label>
              <Textarea id="pickupAddress" rows={2} placeholder="Av. Corrientes 1234, CABA" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openingHours">Horarios de atención</Label>
              <Input id="openingHours" placeholder="Lun a Vie de 10 a 18 hs" value={openingHours} onChange={(e) => setOpeningHours(e.target.value)} />
            </div>
            {save}
          </>
        )}

        {tab === 'cobros' && (
          <>
            <p className="text-sm text-muted-foreground">Elegí qué medios de pago se le ofrecen al cliente al finalizar la compra.</p>

            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={enableBankTransfer} onChange={(e) => setEnableBankTransfer(e.target.checked)} />
                Transferencia bancaria
              </label>
              {enableBankTransfer && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="bankTransferInstructions" className="text-xs">Datos para la transferencia</Label>
                  <Textarea
                    id="bankTransferInstructions"
                    rows={3}
                    placeholder="CBU, alias, titular de la cuenta…"
                    value={bankTransferInstructions}
                    onChange={(e) => setBankTransferInstructions(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Se le muestran al cliente cuando elige transferencia.</p>
                </div>
              )}
              {enableBankTransfer && (
                <DescuentoMedioPago
                  label="transferencia"
                  value={bankTransferDiscount}
                  onChange={setBankTransferDiscount}
                />
              )}
            </div>

            <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm font-medium">
              <input type="checkbox" checked={enableCardPayment} onChange={(e) => setEnableCardPayment(e.target.checked)} />
              <span>
                Tarjeta (Ualá / Mercado Pago)
                <span className="block text-xs font-normal text-muted-foreground">Solo se ofrece si la pasarela tiene credenciales cargadas.</span>
              </span>
            </label>

            <div className="space-y-3 rounded-md border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={enableCash} onChange={(e) => setEnableCash(e.target.checked)} />
                <span>
                  Efectivo
                  <span className="block text-xs font-normal text-muted-foreground">El cliente paga al retirar en el local.</span>
                </span>
              </label>
              {enableCash && (
                <DescuentoMedioPago label="efectivo" value={cashDiscount} onChange={setCashDiscount} />
              )}
            </div>
            {save}
          </>
        )}

        {tab === 'seguridad' && <ChangePasswordForm />}
      </div>
    </div>
  );
}

function ChangePasswordForm() {
  const api = useApi();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      api('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    onSuccess: () => {
      setError(null);
      setDone(true);
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err) => {
      setDone(false);
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar la contraseña.');
    },
  });

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">Nueva contraseña</Label>
        <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <p className="text-xs text-muted-foreground">Mínimo 8 caracteres. Al cambiarla se cierran las otras sesiones.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {done && <p className="text-sm text-emerald-600">Contraseña actualizada.</p>}
      <Button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || currentPassword.length < 1 || newPassword.length < 8}
      >
        {mutation.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
      </Button>
    </div>
  );
}
