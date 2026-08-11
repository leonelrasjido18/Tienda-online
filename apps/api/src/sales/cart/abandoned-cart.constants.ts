export const ABANDONED_CART_QUEUE = 'abandoned-cart';

/** Etapas de recordatorio: minutos de inactividad → nivel. */
export const ABANDONED_CART_STAGES = [
  { stage: 1, afterMs: 4 * 60 * 60 * 1000 }, // 4 h
  { stage: 2, afterMs: 24 * 60 * 60 * 1000 }, // 24 h
  { stage: 3, afterMs: 72 * 60 * 60 * 1000 }, // 72 h
] as const;
