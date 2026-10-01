import type { ActivePreorderWindowDto, StoreSettingsDto } from '@tienda/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Wrapper seguro sobre fetch: si la API falla devuelve null en vez de tirar.
 * Para Server Components que no deben tumbar la página por un error de API.
 */
export async function apiFetchSafe<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

const DEFAULT_SETTINGS: StoreSettingsDto = {
  defaultDepositPercent: 50,
  bankTransferInstructions: null,
  whatsappPhone: null,
  whatsappMessage: null,
  instagramUser: null,
  contactEmail: null,
  pickupAddress: null,
  openingHours: null,
  enableBankTransfer: true,
  enableCardPayment: true,
  enableCash: false,
  // Sin descuento: si la API no responde, nunca se anuncia un precio que no se
  // va a respetar al cobrar.
  bankTransferDiscount: { mode: 'percentage', value: 0 },
  cashDiscount: { mode: 'percentage', value: 0 },
};

/**
 * Obtener los settings de la tienda con fallback seguro.
 * Nunca devuelve null: si la API falla, devuelve defaults.
 */
export async function getStoreSettings(): Promise<StoreSettingsDto> {
  const data = await apiFetchSafe<StoreSettingsDto>('/settings');
  return data ?? DEFAULT_SETTINGS;
}

/** Ventana de encargo activa (para la cuenta regresiva). Null si no hay ninguna. */
export async function getPreorderWindow(): Promise<ActivePreorderWindowDto | null> {
  return apiFetchSafe<ActivePreorderWindowDto>('/preorder/window');
}
