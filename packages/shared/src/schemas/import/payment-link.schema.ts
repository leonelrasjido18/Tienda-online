import { z } from 'zod';

export const PAYMENT_LINK_STATUSES = ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'] as const;
export type PaymentLinkStatus = (typeof PAYMENT_LINK_STATUSES)[number];

export const PAYMENT_LINK_TRANSITIONS: Record<PaymentLinkStatus, PaymentLinkStatus[]> = {
  PENDING: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: [],
  EXPIRED: [],
  CANCELLED: [],
};

export function canTransitionPaymentLink(from: PaymentLinkStatus, to: PaymentLinkStatus): boolean {
  return PAYMENT_LINK_TRANSITIONS[from].includes(to);
}

/** Vista pública del saldo: es lo que ve el cliente al abrir el link del email. */
export const balanceCheckoutSchema = z.object({
  token: z.string(),
  status: z.enum(PAYMENT_LINK_STATUSES),
  expiresAt: z.string(),
  orderDisplayNumber: z.string(),
  contactName: z.string(),
  balanceCents: z.number().int(),
  shippingCents: z.number().int(),
  amountCents: z.number().int(),
  pickupInStore: z.boolean(),
  shippingAddress: z.string().nullable(),
  items: z.array(
    z.object({
      productName: z.string(),
      optionsLabel: z.string().nullable(),
      imageUrl: z.string().nullable(),
      quantity: z.number().int(),
      playerName: z.string().nullable(),
      playerNumber: z.number().int().nullable(),
    }),
  ),
});
export type BalanceCheckoutDto = z.infer<typeof balanceCheckoutSchema>;

export const payBalanceResponseSchema = z.object({
  redirectUrl: z.string().nullable(),
  bankTransferInstructions: z.string().nullable(),
  amountCents: z.number().int(),
});
export type PayBalanceResponse = z.infer<typeof payBalanceResponseSchema>;

/** Marca manual del saldo como cobrado (transferencia recibida por fuera). */
export const markBalancePaidSchema = z.object({
  note: z.string().max(300).nullish(),
});
export type MarkBalancePaidInput = z.infer<typeof markBalancePaidSchema>;
