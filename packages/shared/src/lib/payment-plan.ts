export type ResolvedFulfillment = 'IN_STOCK' | 'PREORDER';

export interface PaymentPlanLineItem {
  totalCents: number;
  fulfillment: ResolvedFulfillment;
}

export interface PaymentPlanResult {
  plan: 'FULL' | 'DEPOSIT_BALANCE';
  subtotalCents: number;
  depositCents: number | null;
  balanceCents: number | null;
  dueTodayCents: number;
}

/**
 * Si al menos un item quedó como PREORDER, toda la orden pasa a seña + saldo.
 * El envío se cotiza recién cuando llega el lote, así que nunca entra acá.
 */
export function calculatePaymentPlan(items: PaymentPlanLineItem[], depositPercent: number): PaymentPlanResult {
  const subtotalCents = items.reduce((sum, item) => sum + item.totalCents, 0);
  const hasPreorder = items.some((item) => item.fulfillment === 'PREORDER');

  if (!hasPreorder) {
    return { plan: 'FULL', subtotalCents, depositCents: null, balanceCents: null, dueTodayCents: subtotalCents };
  }

  const depositCents = Math.round((subtotalCents * depositPercent) / 100);
  const balanceCents = subtotalCents - depositCents;
  return { plan: 'DEPOSIT_BALANCE', subtotalCents, depositCents, balanceCents, dueTodayCents: depositCents };
}

/**
 * Aplica un descuento de cupón sobre el subtotal de un plan ya calculado.
 *
 * `subtotalCents` se conserva como el bruto (lo que suman los items); el descuento
 * baja lo que efectivamente se cobra. Con seña + saldo, el descuento se reparte
 * proporcionalmente: la seña se recalcula sobre el neto y el saldo es el resto. El
 * descuento se topa al subtotal para que nunca quede un total negativo.
 *
 * Los cupones de envío gratis no tocan el subtotal (envío gratis se resuelve al
 * cotizar el envío, en otra etapa), así que se pasa `discountCents = 0`.
 */
export function applyDiscountToPlan(
  plan: PaymentPlanResult,
  discountCents: number,
  depositPercent: number,
): PaymentPlanResult {
  const clamped = Math.min(Math.max(0, Math.round(discountCents)), plan.subtotalCents);
  if (clamped === 0) return plan;

  const netCents = plan.subtotalCents - clamped;

  if (plan.plan === 'FULL') {
    return { ...plan, dueTodayCents: netCents };
  }

  const depositCents = Math.round((netCents * depositPercent) / 100);
  return { ...plan, depositCents, balanceCents: netCents - depositCents, dueTodayCents: depositCents };
}
