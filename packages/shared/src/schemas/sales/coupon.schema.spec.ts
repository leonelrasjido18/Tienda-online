import { describe, expect, it } from 'vitest';

import { upsertCouponSchema, validateCouponSchema } from './coupon.schema';

/** Cupón válido mínimo; cada test pisa sólo el campo que le importa. */
function cupon(over: Record<string, unknown> = {}) {
  return { code: 'VERANO10', type: 'PERCENTAGE', value: 10, ...over };
}

describe('upsertCouponSchema', () => {
  it('acepta un cupón de porcentaje normal', () => {
    const r = upsertCouponSchema.parse(cupon());
    expect(r.value).toBe(10);
    // Los valores por defecto evitan que falten campos al guardar.
    expect(r.minPurchaseCents).toBe(0);
    expect(r.isActive).toBe(true);
    expect(r.oncePerCustomer).toBe(false);
  });

  describe('el porcentaje va de 1 a 100', () => {
    // Es el bug que dejaba pedidos con total negativo: el controlador validaba
    // con una interface de TypeScript, que no existe en tiempo de ejecución.
    it('rechaza 150', () => {
      expect(upsertCouponSchema.safeParse(cupon({ value: 150 })).success).toBe(false);
    });

    it('rechaza 0', () => {
      expect(upsertCouponSchema.safeParse(cupon({ value: 0 })).success).toBe(false);
    });

    it('acepta 100', () => {
      expect(upsertCouponSchema.safeParse(cupon({ value: 100 })).success).toBe(true);
    });
  });

  it('rechaza valores negativos', () => {
    expect(upsertCouponSchema.safeParse(cupon({ value: -20 })).success).toBe(false);
  });

  it('exige un monto mayor a cero en los cupones de monto fijo', () => {
    expect(upsertCouponSchema.safeParse(cupon({ type: 'FIXED_AMOUNT', value: 0 })).success).toBe(false);
    expect(upsertCouponSchema.safeParse(cupon({ type: 'FIXED_AMOUNT', value: 500_000 })).success).toBe(true);
  });

  it('no permite un monto fijo por encima del tope del porcentaje', () => {
    // 5000 no es un porcentaje válido pero sí un monto fijo en centavos.
    expect(upsertCouponSchema.safeParse(cupon({ type: 'FIXED_AMOUNT', value: 5000 })).success).toBe(true);
    expect(upsertCouponSchema.safeParse(cupon({ type: 'PERCENTAGE', value: 5000 })).success).toBe(false);
  });

  describe('código', () => {
    it('lo exige', () => {
      expect(upsertCouponSchema.safeParse({ type: 'PERCENTAGE', value: 10 }).success).toBe(false);
    });

    it('rechaza espacios y símbolos', () => {
      expect(upsertCouponSchema.safeParse(cupon({ code: 'VERANO 10' })).success).toBe(false);
      expect(upsertCouponSchema.safeParse(cupon({ code: 'VERANO$' })).success).toBe(false);
    });

    it('acepta guiones y guiones bajos', () => {
      expect(upsertCouponSchema.safeParse(cupon({ code: 'BLACK-FRIDAY_26' })).success).toBe(true);
    });

    it('rechaza códigos demasiado cortos', () => {
      expect(upsertCouponSchema.safeParse(cupon({ code: 'AB' })).success).toBe(false);
    });
  });

  it('rechaza un tipo inventado', () => {
    expect(upsertCouponSchema.safeParse(cupon({ type: 'REGALO' })).success).toBe(false);
  });

  it('rechaza una fecha de vencimiento ya pasada', () => {
    expect(upsertCouponSchema.safeParse(cupon({ expiresAt: '2020-01-01' })).success).toBe(false);
    const futuro = new Date(Date.now() + 86_400_000).toISOString();
    expect(upsertCouponSchema.safeParse(cupon({ expiresAt: futuro })).success).toBe(true);
  });

  it('exige que el límite de usos sea positivo', () => {
    expect(upsertCouponSchema.safeParse(cupon({ maxUses: 0 })).success).toBe(false);
    expect(upsertCouponSchema.safeParse(cupon({ maxUses: -3 })).success).toBe(false);
    expect(upsertCouponSchema.safeParse(cupon({ maxUses: null })).success).toBe(true);
  });
});

describe('validateCouponSchema', () => {
  it('exige código y subtotal', () => {
    expect(validateCouponSchema.safeParse({ code: 'VERANO10', subtotalCents: 100_000 }).success).toBe(true);
    expect(validateCouponSchema.safeParse({ code: 'VERANO10' }).success).toBe(false);
    expect(validateCouponSchema.safeParse({ subtotalCents: 100_000 }).success).toBe(false);
  });

  it('rechaza un subtotal negativo', () => {
    expect(validateCouponSchema.safeParse({ code: 'X', subtotalCents: -1 }).success).toBe(false);
  });
});
