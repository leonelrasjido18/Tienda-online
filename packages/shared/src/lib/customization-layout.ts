import type { PrintArea } from '../schemas/customization/print-area.schema';

export interface AbsolutePrintBox {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  align: 'left' | 'center' | 'right';
}

/** Convierte una zona de impresión normalizada (0-1) a píxeles reales para una imagen dada. */
export function resolvePrintArea(area: PrintArea, imageWidth: number, imageHeight: number): AbsolutePrintBox {
  return {
    left: area.x * imageWidth,
    top: area.y * imageHeight,
    width: area.width * imageWidth,
    height: area.height * imageHeight,
    rotation: area.rotation,
    align: area.align,
  };
}

const DEFAULT_CHAR_WIDTH_RATIO = 0.62;
const MIN_FONT_SIZE = 8;

/**
 * Tamaño de fuente que hace entrar el texto en la caja, sin desbordar ni por ancho ni por alto.
 * Misma función para el preview en el navegador (SVG) y el render en el servidor (satori), así
 * el cliente ve exactamente lo que va a recibir.
 */
export function computeFontSizeForBox(
  text: string,
  box: { width: number; height: number },
  options?: { charWidthRatio?: number },
): number {
  const charWidthRatio = options?.charWidthRatio ?? DEFAULT_CHAR_WIDTH_RATIO;
  const heightConstrained = box.height;

  if (text.length === 0) {
    return heightConstrained;
  }

  const widthConstrained = box.width / (text.length * charWidthRatio);
  return Math.max(MIN_FONT_SIZE, Math.min(heightConstrained, widthConstrained));
}
