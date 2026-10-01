import { describe, expect, it } from 'vitest';

import {
  formatOrderNumber,
  canTransitionOrderFinancial,
  canTransitionPayment,
} from './order.schema';

describe('formatOrderNumber', () => {
  it('arranca en #1001 para el primer pedido', () => {
    expect(formatOrderNumber(1)).toBe('#1001');
  });

  it('sigue la secuencia', () => {
    expect(formatOrderNumber(42)).toBe('#1042');
  });
});

describe('canTransitionOrderFinancial', () => {
  it('permite transiciones validas', () => {
    expect(canTransitionOrderFinancial('PENDING', 'PAID')).toBe(true);
    expect(canTransitionOrderFinancial('PENDING', 'DEPOSIT_PAID')).toBe(true);
    expect(canTransitionOrderFinancial('DEPOSIT_PAID', 'AWAITING_BALANCE')).toBe(true);
    expect(canTransitionOrderFinancial('AWAITING_BALANCE', 'PAID')).toBe(true);
    expect(canTransitionOrderFinancial('PAID', 'REFUNDED')).toBe(true);
  });

  it('rechaza transiciones invalidas', () => {
    expect(canTransitionOrderFinancial('PAID', 'PENDING')).toBe(false);
    expect(canTransitionOrderFinancial('EXPIRED', 'PAID')).toBe(false);
    expect(canTransitionOrderFinancial('FAILED', 'PAID')).toBe(false);
  });
});

describe('canTransitionPayment', () => {
  it('permite transiciones validas de pago', () => {
    expect(canTransitionPayment('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionPayment('PENDING', 'CANCELLED')).toBe(true);
    expect(canTransitionPayment('APPROVED', 'REFUNDED')).toBe(true);
  });

  it('rechaza transiciones invalidas de pago', () => {
    expect(canTransitionPayment('APPROVED', 'PENDING')).toBe(false);
    expect(canTransitionPayment('CANCELLED', 'APPROVED')).toBe(false);
  });

  it('acepta que un pago rechazado termine aprobado', () => {
    // Pasó en produccion: Uala mando PENDING -> REJECTED -> APPROVED sobre el
    // mismo pago (el cliente reintento). Con REJECTED como estado final, la
    // aprobacion se descartaba: al cliente se le cobraba y el pedido quedaba
    // cancelado.
    expect(canTransitionPayment('REJECTED', 'APPROVED')).toBe(true);
  });

  it('un pago rechazado no puede volver a quedar pendiente ni cancelarse', () => {
    expect(canTransitionPayment('REJECTED', 'PENDING')).toBe(false);
    expect(canTransitionPayment('REJECTED', 'CANCELLED')).toBe(false);
    expect(canTransitionPayment('REJECTED', 'REFUNDED')).toBe(false);
  });
});
