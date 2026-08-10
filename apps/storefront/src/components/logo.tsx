/**
 * Wordmark de Remeras del Área.
 *
 * Se sirven dos variantes porque el logo original es blanco: sobre el tema claro
 * sería invisible. `wordmark.png` (blanco) se usa en oscuro y `wordmark-dark.png`
 * —generado a partir del mismo archivo, oscureciendo sólo lo blanco y conservando
 * el azul— en claro. El intercambio es por CSS, así que no parpadea al hidratar.
 *
 * Ambos salen del PNG original de la marca, con el fondo negro convertido a
 * transparencia. Si más adelante aparece un SVG vectorial, reemplaza a los dos.
 */
export function Logo({ className = 'h-9 w-auto' }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wordmark-dark.png" alt="Remeras del Área" className={`${className} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/wordmark.png" alt="Remeras del Área" className={`${className} hidden dark:block`} />
    </>
  );
}
