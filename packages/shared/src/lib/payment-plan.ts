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
