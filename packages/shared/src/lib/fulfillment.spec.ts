import { describe, expect, it } from 'vitest';

import { resolveFulfillment, resolvedFulfillmentOf, type FulfillmentInput } from './fulfillment';

const caso = (p: Partial<FulfillmentInput>): FulfillmentInput => ({
  fulfillmentMode: 'BOTH',
  available: 0,
  quantity: 1,
  allowPreorder: false,
  ...p,
});

describe('resolveFulfillment', () => {
  describe('sólo por encargo', () => {
    it('es por encargo aunque sobre stock', () => {
      // El caso que rompía producción: la ficha decía "Entrega Inmediata" porque
      // había una unidad, y el checkout cobraba seña y no cobraba envío.
      expect(resolveFulfillment(caso({ fulfillmentMode: 'PREORDER', available: 5 }))).toEqual({
        kind: 'PREORDER',
      });
    });

    it('es por encargo sin stock', () => {
      expect(resolveFulfillment(caso({ fulfillmentMode: 'PREORDER' }))).toEqual({ kind: 'PREORDER' });
    });
  });

  describe('sólo con stock', () => {
    it('se entrega si alcanza', () => {
      expect(resolveFulfillment(caso({ fulfillmentMode: 'IN_STOCK', available: 2, quantity: 2 }))).toEqual({
        kind: 'IN_STOCK',
      });
    });

    it('no se puede comprar si no alcanza, aunque la variante acepte encargo', () => {
      // El modo manda: si la dueña dijo "sólo con stock", no se cuela un encargo.
      expect(
        resolveFulfillment(
          caso({ fulfillmentMode: 'IN_STOCK', available: 1, quantity: 2, allowPreorder: true }),
        ),
      ).toEqual({ kind: 'UNAVAILABLE' });
    });
  });

  describe('las dos modalidades', () => {
    it('prefiere el stock cuando alcanza', () => {
      expect(resolveFulfillment(caso({ available: 3, quantity: 3 }))).toEqual({ kind: 'IN_STOCK' });
    });

    it('cae a encargo cuando no alcanza y la variante lo permite', () => {
      expect(
        resolveFulfillment(caso({ available: 1, quantity: 2, allowPreorder: true })),
      ).toEqual({ kind: 'PREORDER' });
    });

    it('no se puede comprar si no alcanza y no acepta encargo', () => {
      expect(resolveFulfillment(caso({ available: 1, quantity: 2 }))).toEqual({ kind: 'UNAVAILABLE' });
    });

    it('una unidad de menos ya no es stock', () => {
      expect(resolveFulfillment(caso({ available: 1, quantity: 2, allowPreorder: true }))).toEqual({
        kind: 'PREORDER',
      });
      expect(resolveFulfillment(caso({ available: 2, quantity: 2 }))).toEqual({ kind: 'IN_STOCK' });
    });
  });

  it('resolvedFulfillmentOf devuelve null cuando no se puede comprar', () => {
    expect(resolvedFulfillmentOf(caso({ available: 3, quantity: 1 }))).toBe('IN_STOCK');
    expect(resolvedFulfillmentOf(caso({ fulfillmentMode: 'PREORDER' }))).toBe('PREORDER');
    expect(resolvedFulfillmentOf(caso({ available: 0, quantity: 1 }))).toBeNull();
  });
});
