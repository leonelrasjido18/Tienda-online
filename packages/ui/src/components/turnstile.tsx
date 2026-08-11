'use client';

import { useEffect, useRef, useState } from 'react';

interface TurnstileProps {
  siteKey?: string;
  onSuccess: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
  className?: string;
}

interface TurnstileRenderOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
    onloadTurnstileCallback?: () => void;
  }
}

/** Clave de sitio de prueba de Cloudflare: si es esta (o falta), el CAPTCHA no aplica. */
const TEST_SITE_KEY = '1x00000000000000000000AA';

export function Turnstile({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE_KEY,
  onSuccess,
  onError,
  onExpire,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  // Sólo se muestra el widget con una clave real. Sin ella (dev), se auto-aprueba
  // con un token centinela para no bloquear el formulario ni mostrar el cartel de
  // "solo para pruebas"; el backend tampoco valida cuando la clave es de prueba.
  const enabled = siteKey !== TEST_SITE_KEY && siteKey !== '';

  useEffect(() => {
    if (!enabled) {
      onSuccess('disabled');
      return;
    }

    const scriptId = 'cloudflare-turnstile-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const renderWidget = () => {
      const turnstile = window.turnstile;
      if (containerRef.current && turnstile) {
        // If a widget was already rendered, remove it first
        if (widgetId) {
          try {
            turnstile.remove(widgetId);
          } catch {
            // El widget ya no existe (recarga/HMR): no hay nada que limpiar.
          }
        }

        const id = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: (token: string) => {
            onSuccess(token);
          },
          'error-callback': () => {
            if (onError) onError();
          },
          'expired-callback': () => {
            if (onExpire) onExpire();
          },
        });
        setWidgetId(id);
      }
    };

    window.onloadTurnstileCallback = () => {
      renderWidget();
    };

    if (window.turnstile) {
      renderWidget();
    }

    return () => {
      if (widgetId && window.turnstile) {
        try {
          window.turnstile.remove(widgetId);
        } catch {
          // Idem: si el widget ya se fue, el cleanup es un no-op.
        }
      }
    };
    // `enabled` se deriva de `siteKey`, así que con esa dependencia alcanza.
  }, [siteKey]);

  if (!enabled) return null;

  return <div ref={containerRef} className={className} />;
}
