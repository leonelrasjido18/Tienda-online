import { describe, expect, it } from 'vitest';

import { applyDiscountToPlan, calculatePaymentPlan } from './payment-plan';

describe('calculatePaymentPlan', () => {
  it('cobra el total hoy cuando todos los items tienen stock', () => {
    const result = calculatePaymentPlan(
      [
        { totalCents: 10000, fulfillment: 'IN_STOCK' },
        { totalCents: 5000, fulfillment: 'IN_STOCK' },
      ],
      50,
    );
    expect(result).toEqual({
      plan: 'FULL',
      subtotalCents: 15000,
      depositCents: null,
      balanceCents: null,
      dueTodayCents: 15000,
    });
  });

  it('pasa a seña + saldo si al menos un item es por encargo', () => {
    const result = calculatePaymentPlan(
      [
        { totalCents: 10000, fulfillment: 'IN_STOCK' },
        { totalCents: 20000, fulfillment: 'PREORDER' },
      ],
      50,
    );
    expect(result.plan).toBe('DEPOSIT_BALANCE');
    expect(result.subtotalCents).toBe(30000);
    expect(result.depositCents).toBe(15000);
    expect(result.balanceCents).toBe(15000);
    expect(result.dueTodayCents).toBe(15000);
  });

  it('redondea el porcentaje de seña al centavo más cercano', () => {
    const result = calculatePaymentPlan([{ totalCents: 9999, fulfillment: 'PREORDER' }], 33);
    expect(result.depositCents).toBe(3300);
    expect(result.balanceCents).toBe(6699);
    expect((result.depositCents ?? 0) + (result.balanceCents ?? 0)).toBe(9999);
  });

  it('con carrito vacío no cobra nada', () => {
    const result = calculatePaymentPlan([], 50);
    expect(result).toEqual({ plan: 'FULL', subtotalCents: 0, depositCents: null, balanceCents: null, dueTodayCents: 0 });
  });
});

describe('applyDiscountToPlan', () => {
  it('resta el descuento del total a pagar hoy en un plan FULL', () => {
    const plan = calculatePaymentPlan([{ totalCents: 15000, fulfillment: 'IN_STOCK' }], 50);
    const discounted = applyDiscountToPlan(plan, 3000, 50);
    expect(discounted.subtotalCents).toBe(15000); // el bruto no cambia
    expect(discounted.dueTodayCents).toBe(12000);
  });

  it('reparte el descuento entre seña y saldo en un plan con encargo', () => {
    const plan = calculatePaymentPlan([{ totalCents: 30000, fulfillment: 'PREORDER' }], 50);
    const discounted = applyDiscountToPlan(plan, 10000, 50);
    // Neto 20000 → seña 50% = 10000, saldo 10000
    expect(discounted.subtotalCents).toBe(30000);
    expect(discounted.depositCents).toBe(10000);
    expect(discounted.balanceCents).toBe(10000);
    expect(discounted.dueTodayCents).toBe(10000);
    expect((discounted.depositCents ?? 0) + (discounted.balanceCents ?? 0)).toBe(20000);
  });

  it('nunca deja el total por debajo de cero: topa el descuento al subtotal', () => {
    const plan = calculatePaymentPlan([{ totalCents: 5000, fulfillment: 'IN_STOCK' }], 50);
    const discounted = applyDiscountToPlan(plan, 999999, 50);
    expect(discounted.dueTodayCents).toBe(0);
  });

  it('un descuento de cero devuelve el plan intacto', () => {
    const plan = calculatePaymentPlan([{ totalCents: 8000, fulfillment: 'PREORDER' }], 40);
    expect(applyDiscountToPlan(plan, 0, 40)).toEqual(plan);
  });
});
