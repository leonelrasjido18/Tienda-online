import { describe, expect, it } from 'vitest';

import {
  applyPaymentDiscount,
  bestPaymentDiscount,
  calculatePaymentDiscountCents,
  isDiscountableMethod,
  resolvePaymentDiscount,
  type PaymentDiscountSettings,
} from './payment-discount';

const SIN_DESCUENTO: PaymentDiscountSettings = {
  bank_transfer: { mode: 'percentage', value: 0 },
  cash: { mode: 'percentage', value: 0 },
};

describe('calculatePaymentDiscountCents', () => {
  it('descuenta por porcentaje', () => {
    // $41.500 - 10% = $4.150 de descuento
    expect(calculatePaymentDiscountCents(4_150_000, { mode: 'percentage', value: 10 })).toBe(415_000);
  });

  it('descuenta por monto fijo', () => {
    expect(calculatePaymentDiscountCents(4_150_000, { mode: 'amount', value: 500_000 })).toBe(500_000);
  });

  it('no puede superar la base: un total nunca queda negativo', () => {
    expect(calculatePaymentDiscountCents(100_000, { mode: 'amount', value: 900_000 })).toBe(100_000);
    expect(calculatePaymentDiscountCents(100_000, { mode: 'percentage', value: 150 })).toBe(100_000);
  });

  it('un valor en cero o negativo no descuenta', () => {
    expect(calculatePaymentDiscountCents(4_150_000, { mode: 'percentage', value: 0 })).toBe(0);
    expect(calculatePaymentDiscountCents(4_150_000, { mode: 'amount', value: -500 })).toBe(0);
    expect(calculatePaymentDiscountCents(4_150_000, null)).toBe(0);
  });
});

describe('applyPaymentDiscount', () => {
  it('devuelve el precio final', () => {
    expect(applyPaymentDiscount(4_150_000, { mode: 'percentage', value: 5 })).toBe(3_942_500);
  });
});

describe('resolvePaymentDiscount', () => {
  const settings: PaymentDiscountSettings = {
    bank_transfer: { mode: 'percentage', value: 10 },
    cash: { mode: 'percentage', value: 0 },
  };

  it('devuelve la configuración del medio pedido', () => {
    expect(resolvePaymentDiscount('bank_transfer', settings)).toEqual({ mode: 'percentage', value: 10 });
  });

  it('devuelve null si ese medio no tiene descuento', () => {
    expect(resolvePaymentDiscount('cash', settings)).toBeNull();
  });

  it('los medios con pasarela nunca tienen descuento', () => {
    // La tienda paga comisión: descontar ahí sería regalar plata dos veces.
    expect(resolvePaymentDiscount('uala', settings)).toBeNull();
    expect(resolvePaymentDiscount('mercadopago', settings)).toBeNull();
  });
});

describe('isDiscountableMethod', () => {
  it('distingue los medios sin pasarela', () => {
    expect(isDiscountableMethod('bank_transfer')).toBe(true);
    expect(isDiscountableMethod('cash')).toBe(true);
    expect(isDiscountableMethod('uala')).toBe(false);
  });
});

describe('bestPaymentDiscount', () => {
  it('elige el descuento más grande para anunciarlo', () => {
    const settings: PaymentDiscountSettings = {
      bank_transfer: { mode: 'percentage', value: 5 },
      cash: { mode: 'percentage', value: 12 },
    };
    expect(bestPaymentDiscount(4_150_000, settings)).toEqual({
      method: 'cash',
      discountCents: 498_000,
      finalCents: 3_652_000,
    });
  });

  it('devuelve null si no hay ninguno activo', () => {
    expect(bestPaymentDiscount(4_150_000, SIN_DESCUENTO)).toBeNull();
  });

  it('compara montos y porcentajes en igualdad de condiciones', () => {
    const settings: PaymentDiscountSettings = {
      bank_transfer: { mode: 'amount', value: 600_000 },
      cash: { mode: 'percentage', value: 10 },
    };
    // 10% de $41.500 son $4.150; el monto fijo de $6.000 gana.
    expect(bestPaymentDiscount(4_150_000, settings)?.method).toBe('bank_transfer');
  });
});
