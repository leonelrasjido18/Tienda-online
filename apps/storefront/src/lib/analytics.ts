/**
 * Helper mínimo para mandar eventos a Google Analytics 4 (gtag).
 * No hace nada si GA no está cargado (ej. sin NEXT_PUBLIC_GA4_ID), así que es
 * seguro llamarlo siempre.
 */
type GtagParams = Record<string, unknown>;

export function trackEvent(name: string, params?: GtagParams): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  if (typeof w.gtag === 'function') {
    w.gtag('event', name, params ?? {});
  }
}
