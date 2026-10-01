import { describe, expect, it } from 'vitest';

import { applyBulkPrice, bulkPriceAdjustmentSchema } from './bulk-pricing.schema';

/** Ajuste base; cada test pisa lo que le importa. */
function ajuste(over: Record<string, unknown> = {}) {
  return bulkPriceAdjustmentSchema.parse({ mode: 'percentage', value: 10, ...over });
}

describe('applyBulkPrice', () => {
  it('sube por porcentaje', () => {
    // $42.000 + 10% = $46.200
    expect(applyBulkPrice(4_200_000, ajuste({ value: 10 }))).toBe(4_620_000);
  });

  it('sube por monto fijo', () => {
    expect(applyBulkPrice(4_200_000, ajuste({ mode: 'amount', value: 500_000 }))).toBe(4_700_000);
  });

  it('permite bajar precios', () => {
    expect(applyBulkPrice(4_000_000, ajuste({ value: -25 }))).toBe(3_000_000);
    expect(applyBulkPrice(4_000_000, ajuste({ mode: 'amount', value: -500_000 }))).toBe(3_500_000);
  });

  describe('redondeo', () => {
    it('lleva al múltiplo más cercano', () => {
      // $42.000 + 13% = $47.460 -> redondeado a $500 -> $47.500
      expect(applyBulkPrice(4_200_000, ajuste({ value: 13, roundTo: 50_000 }))).toBe(4_750_000);
    });

    it('sin redondeo deja el valor exacto', () => {
      expect(applyBulkPrice(4_200_000, ajuste({ value: 13, roundTo: 0 }))).toBe(4_746_000);
    });
  });

  it('respeta el piso aunque el redondeo quede por debajo', () => {
    // El piso se aplica DESPUÉS del redondeo, si no podría anularlo.
    const r = applyBulkPrice(1_000_000, ajuste({ value: -80, roundTo: 100_000, minPriceCents: 500_000 }));
    expect(r).toBe(500_000);
  });

  it('nunca devuelve un precio negativo', () => {
    expect(applyBulkPrice(100_000, ajuste({ mode: 'amount', value: -900_000 }))).toBe(0);
  });
});

describe('bulkPriceAdjustmentSchema', () => {
  it('rechaza un ajuste de cero', () => {
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'percentage', value: 0 }).success).toBe(false);
  });

  it('acota el porcentaje', () => {
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'percentage', value: 600 }).success).toBe(false);
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'percentage', value: -95 }).success).toBe(false);
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'percentage', value: 15 }).success).toBe(true);
  });

  it('no acota el monto fijo por el límite del porcentaje', () => {
    // 600 centavos es un monto válido aunque 600% no lo sea.
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'amount', value: 600 }).success).toBe(true);
  });

  it('rechaza un tipo inventado', () => {
    expect(bulkPriceAdjustmentSchema.safeParse({ mode: 'regalo', value: 10 }).success).toBe(false);
  });
});
