import { describe, expect, it } from 'vitest';

import { calculateCustomizationExtraCents } from './customization-price';

const PARCHE_CHAMPIONS = { patchId: 'champions', patch: { priceCents: 300_000 } };
const PARCHE_LIGA = { patchId: 'liga', patch: { priceCents: 200_000 } };

/** Plantilla como las del catálogo: $3.500 + $3.500 = $7.000 de personalización. */
const PLANTILLA = {
  nameExtraCents: 350_000,
  numberExtraCents: 350_000,
  patchOptions: [PARCHE_CHAMPIONS, PARCHE_LIGA],
};

describe('calculateCustomizationExtraCents', () => {
  describe('nombre y dorsal se cobran juntos, una sola vez', () => {
    it('cobra lo mismo con los dos que con uno solo', () => {
      const ambos = calculateCustomizationExtraCents({ playerName: 'MESSI', playerNumber: 10 }, PLANTILLA);
      const soloNombre = calculateCustomizationExtraCents({ playerName: 'MESSI' }, PLANTILLA);
      const soloDorsal = calculateCustomizationExtraCents({ playerNumber: 10 }, PLANTILLA);

      expect(ambos).toBe(700_000);
      expect(soloNombre).toBe(700_000);
      expect(soloDorsal).toBe(700_000);
    });

    it('no cobra nada si no se personalizó', () => {
      expect(calculateCustomizationExtraCents({}, PLANTILLA)).toBe(0);
      expect(calculateCustomizationExtraCents({ playerName: '', playerNumber: null }, PLANTILLA)).toBe(0);
    });

    it('el dorsal 0 es un dorsal válido y se cobra', () => {
      expect(calculateCustomizationExtraCents({ playerNumber: 0 }, PLANTILLA)).toBe(700_000);
    });
  });

  describe('parches', () => {
    it('se cobran uno por uno: son piezas distintas', () => {
      const extra = calculateCustomizationExtraCents(
        { playerName: 'MESSI', patchIds: ['champions', 'liga'] },
        PLANTILLA,
      );
      expect(extra).toBe(700_000 + 300_000 + 200_000);
    });

    it('se pueden llevar sin nombre ni dorsal', () => {
      expect(calculateCustomizationExtraCents({ patchIds: ['liga'] }, PLANTILLA)).toBe(200_000);
    });

    it('ignora un parche que el producto no ofrece', () => {
      expect(calculateCustomizationExtraCents({ patchIds: ['inventado'] }, PLANTILLA)).toBe(0);
    });
  });

  it('sin plantilla o sin datos no cobra nada', () => {
    expect(calculateCustomizationExtraCents(null, PLANTILLA)).toBe(0);
    expect(calculateCustomizationExtraCents({ playerName: 'MESSI' }, null)).toBe(0);
  });

  it('respeta una plantilla con el importe entero en un solo campo', () => {
    // Es como lo guarda el panel ahora: un único importe, el otro en cero.
    const nueva = { nameExtraCents: 700_000, numberExtraCents: 0, patchOptions: [] };
    expect(calculateCustomizationExtraCents({ playerNumber: 7 }, nueva)).toBe(700_000);
  });
});
