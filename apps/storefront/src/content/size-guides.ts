/* BORRADOR — Validar medidas con la clienta antes de publicar */

export interface SizeGuideTable {
  title: string;
  rows: { size: string; chestCm: number; lengthCm: number }[];
}

export const SIZE_GUIDES: Record<string, SizeGuideTable> = {
  fan: {
    title: 'Camisetas Versión Fan (Holgada)',
    rows: [
      { size: 'S', chestCm: 50, lengthCm: 70 },
      { size: 'M', chestCm: 52, lengthCm: 72 },
      { size: 'L', chestCm: 54, lengthCm: 74 },
      { size: 'XL', chestCm: 56, lengthCm: 76 },
      { size: 'XXL', chestCm: 58, lengthCm: 78 },
    ],
  },
  player: {
    title: 'Camisetas Versión Jugador (Entallada)',
    rows: [
      { size: 'S', chestCm: 47, lengthCm: 68 },
      { size: 'M', chestCm: 49, lengthCm: 70 },
      { size: 'L', chestCm: 51, lengthCm: 72 },
      { size: 'XL', chestCm: 53, lengthCm: 74 },
      { size: 'XXL', chestCm: 55, lengthCm: 76 },
    ],
  },
};
