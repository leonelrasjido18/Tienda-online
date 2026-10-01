'use client';

import { formatCentsAsArs } from '@tienda/shared';
import { Check, Copy, MessageSquare } from 'lucide-react';
import { useState } from 'react';

interface Props {
  metodo: 'bank_transfer' | 'cash';
  montoCents: number;
  numeroPedido: string;
  nombreCliente: string;
  /** Texto libre que carga la dueña: CBU, alias, titular. */
  instrucciones: string | null;
  /** Dirección del local, para el pago en efectivo. */
  direccionRetiro: string | null;
  whatsappPhone: string | null;
}

/**
 * Se busca por la etiqueta y no por el formato del valor.
 *
 * Adivinar el formato fallaba: un alias como `remerasdelarea.uala` tiene dos
 * partes, y el patrón de "tres palabras con puntos" terminaba capturando el
 * `S.A.U` de "Ualá Bank S.A.U." como si fuera el alias.
 */
const RE_ALIAS_ETIQUETADO = /alias\s*:?\s*([^\s,;]+)/i;
const RE_CBU_ETIQUETADO = /\bcbu\s*:?\s*(\d[\d\s-]{20,})/i;
/** Respaldo si no hay etiqueta: 22 dígitos seguidos son un CBU. */
const RE_CBU_SUELTO = /\b\d{22}\b/;

/** El CBU se copia sin espacios ni guiones, listo para pegar en el banco. */
function limpiarNumero(valor: string): string {
  return valor.replace(/[\s-]/g, '');
}

function BotonCopiar({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  const [falla, setFalla] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setFalla(false);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Algunos navegadores lo bloquean; se avisa en vez de fingir que copió.
      setFalla(true);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copiar()}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
    >
      {copiado ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
      {falla ? 'Copiá a mano' : copiado ? 'Copiado' : etiqueta}
    </button>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        <p className="break-all font-mono text-sm font-medium">{valor}</p>
      </div>
      <BotonCopiar texto={valor} etiqueta="Copiar" />
    </div>
  );
}

/**
 * Datos para pagar por transferencia o efectivo, con todo lo que el cliente
 * necesita a mano: el monto exacto, los datos de la cuenta y el botón para
 * mandar el comprobante.
 */
export function DatosDePago({
  metodo,
  montoCents,
  numeroPedido,
  nombreCliente,
  instrucciones,
  direccionRetiro,
  whatsappPhone,
}: Props) {
  const monto = formatCentsAsArs(montoCents);

  // CBU y alias con botón propio; si no se reconocen, queda el bloque completo
  // con un solo "Copiar datos" y no se pierde nada.
  const cbuCrudo =
    instrucciones?.match(RE_CBU_ETIQUETADO)?.[1] ?? instrucciones?.match(RE_CBU_SUELTO)?.[0] ?? null;
  const cbu = cbuCrudo ? limpiarNumero(cbuCrudo) : null;
  // Se descarta el punto final de la oración, que no forma parte del alias.
  const alias = instrucciones?.match(RE_ALIAS_ETIQUETADO)?.[1]?.replace(/[.,;]+$/, '') ?? null;

  const mensaje = [
    `Hola! Te envío el comprobante del pedido ${numeroPedido}.`,
    `Nombre: ${nombreCliente}`,
    `Monto: ${monto}`,
    metodo === 'bank_transfer' ? 'Pagué por transferencia.' : 'Voy a pagar en efectivo al retirar.',
  ].join('\n');

  const linkWhatsapp = whatsappPhone
    ? `https://wa.me/${whatsappPhone.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`
    : null;

  return (
    <div className="mt-6 space-y-4 rounded-lg border border-border bg-muted/30 p-4 text-left">
      <div>
        <p className="font-medium">
          {metodo === 'bank_transfer' ? 'Transferí este monto para confirmar tu pedido' : 'Vas a pagar al retirar'}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2">
          <div>
            <p className="text-xs text-muted-foreground">Monto a pagar</p>
            <p className="text-xl font-extrabold tabular-nums text-foreground">{monto}</p>
          </div>
          <BotonCopiar texto={String(montoCents / 100)} etiqueta="Copiar monto" />
        </div>
      </div>

      {metodo === 'bank_transfer' && instrucciones && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Datos para la transferencia
          </p>

          {cbu && <Dato etiqueta="CBU" valor={cbu} />}
          {alias && <Dato etiqueta="Alias" valor={alias} />}

          {/* Siempre se muestra el texto completo: puede tener titular, banco o
              aclaraciones que no se detectan automáticamente. */}
          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 whitespace-pre-line break-words text-sm text-muted-foreground">
                {instrucciones}
              </p>
              <BotonCopiar texto={instrucciones} etiqueta="Copiar datos" />
            </div>
          </div>
        </div>
      )}

      {metodo === 'cash' && direccionRetiro && (
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-xs text-muted-foreground">Dirección del local</p>
          <p className="mt-0.5 whitespace-pre-line text-sm">{direccionRetiro}</p>
        </div>
      )}

      {linkWhatsapp && (
        <div>
          <a
            href={linkWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
          >
            <MessageSquare className="h-4 w-4" />
            Cliqueá acá para enviar el comprobante
          </a>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Se abre WhatsApp con el mensaje escrito; solo tenés que adjuntar la foto del comprobante.
          </p>
        </div>
      )}

      <p className="border-t border-border pt-3 text-sm text-muted-foreground">
        Te avisamos por email apenas confirmemos el pago.
      </p>
    </div>
  );
}
