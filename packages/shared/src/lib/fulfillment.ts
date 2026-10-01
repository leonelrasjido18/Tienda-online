import type { FulfillmentMode } from '../schemas/catalog/product.schema';
import type { ResolvedFulfillment } from './payment-plan';

/**
 * Cómo se entrega un ítem: con stock o por encargo.
 *
 * Es la decisión que define cuánto paga el cliente hoy. Si resuelve `IN_STOCK`
 * se cobra el total y el envío en el checkout; si resuelve `PREORDER`, el pedido
 * entero pasa a seña + saldo y el envío se cotiza cuando llega el lote.
 *
 * Estaba escrita tres veces —la ficha del producto, el checkout de la tienda y
 * el checkout de la API— y no decían lo mismo: la ficha miraba sólo el stock e
 * ignoraba `fulfillmentMode`, así que una camiseta marcada PREORDER con una
 * unidad suelta prometía "Entrega Inmediata" y después cobraba seña, sin envío.
 */

export type FulfillmentDecision =
  | { kind: 'IN_STOCK' }
  | { kind: 'PREORDER' }
  /** No se puede comprar: ni hay stock ni se acepta encargo. */
  | { kind: 'UNAVAILABLE' };

export interface FulfillmentInput {
  /** Cómo se PUEDE vender el producto, según el panel. */
  fulfillmentMode: FulfillmentMode;
  /** Unidades libres: las que hay menos las reservadas por otros carritos. */
  available: number;
  quantity: number;
  /** Si la variante acepta encargo cuando se queda sin stock. */
  allowPreorder: boolean;
}

export function resolveFulfillment(input: FulfillmentInput): FulfillmentDecision {
  // Un producto marcado sólo por encargo se vende por encargo aunque quede una
  // unidad dando vueltas: el modo dice cómo se vende, no qué hay en el depósito.
  // Si la dueña quiere venderlo con entrega inmediata, lo marca IN_STOCK o BOTH.
  if (input.fulfillmentMode === 'PREORDER') return { kind: 'PREORDER' };

  const hayStock = input.available >= input.quantity;

  if (input.fulfillmentMode === 'IN_STOCK') {
    return hayStock ? { kind: 'IN_STOCK' } : { kind: 'UNAVAILABLE' };
  }

  // BOTH: primero lo que hay, y si no alcanza se ofrece por encargo.
  if (hayStock) return { kind: 'IN_STOCK' };
  return input.allowPreorder ? { kind: 'PREORDER' } : { kind: 'UNAVAILABLE' };
}

/** Atajo para las pantallas, que ya saben que el ítem es comprable. */
export function resolvedFulfillmentOf(input: FulfillmentInput): ResolvedFulfillment | null {
  const d = resolveFulfillment(input);
  return d.kind === 'UNAVAILABLE' ? null : d.kind;
}
