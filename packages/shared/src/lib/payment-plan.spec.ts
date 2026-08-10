import { describe, expect, it } from 'vitest';

import { calculatePaymentPlan } from './payment-plan';

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
