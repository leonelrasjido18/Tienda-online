import { describe, expect, it } from 'vitest';

import { canTransition, IMPORT_BATCH_STATUSES, type ImportBatchStatus } from './batch.schema';

describe('canTransition', () => {
  it('permite el camino feliz completo', () => {
    expect(canTransition('OPEN', 'ORDERED')).toBe(true);
    expect(canTransition('ORDERED', 'IN_TRANSIT')).toBe(true);
    expect(canTransition('IN_TRANSIT', 'CUSTOMS')).toBe(true);
    expect(canTransition('CUSTOMS', 'RECEIVED')).toBe(true);
    expect(canTransition('RECEIVED', 'CLOSED')).toBe(true);
  });

  it('permite saltear aduana cuando el lote no queda retenido', () => {
    expect(canTransition('IN_TRANSIT', 'RECEIVED')).toBe(true);
  });

  it('nunca permite retroceder', () => {
    // Retroceder dejaría pedidos con links de saldo ya emitidos en un estado inconsistente.
    const order: ImportBatchStatus[] = ['OPEN', 'ORDERED', 'IN_TRANSIT', 'CUSTOMS', 'RECEIVED', 'CLOSED'];
    for (let i = 0; i < order.length; i++) {
      for (let j = 0; j < i; j++) {
        expect(canTransition(order[i]!, order[j]!)).toBe(false);
      }
    }
  });

  it('no permite saltear el cobro del saldo yendo directo a CLOSED', () => {
    expect(canTransition('IN_TRANSIT', 'CLOSED')).toBe(false);
    expect(canTransition('OPEN', 'RECEIVED')).toBe(false);
  });

  it('CLOSED es terminal', () => {
    for (const status of IMPORT_BATCH_STATUSES) {
      expect(canTransition('CLOSED', status)).toBe(false);
    }
  });
});
