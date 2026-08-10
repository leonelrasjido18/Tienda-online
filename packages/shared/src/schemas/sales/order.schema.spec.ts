import { describe, expect, it } from 'vitest';

import { formatOrderNumber } from './order.schema';

describe('formatOrderNumber', () => {
  it('arranca en #1001 para el primer pedido', () => {
    expect(formatOrderNumber(1)).toBe('#1001');
  });

  it('sigue la secuencia', () => {
    expect(formatOrderNumber(42)).toBe('#1042');
  });
});
