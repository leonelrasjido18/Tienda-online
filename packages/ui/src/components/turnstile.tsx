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

export function Turnstile({
  siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
  onSuccess,
  onError,
  onExpire,
  className,
}: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  useEffect(() => {
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
  }, [siteKey]);

  return <div ref={containerRef} className={className} />;
}
