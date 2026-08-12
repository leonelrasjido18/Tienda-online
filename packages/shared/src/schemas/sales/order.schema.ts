import { z } from 'zod';

import { FULFILLMENT_MODES } from '../catalog/product.schema';
import { createShipmentSchema, shipmentDtoSchema, updateShipmentSchema } from '../shipping/shipping.schema';

export const ORDER_FINANCIAL_STATUSES = [
  'PENDING',
  'DEPOSIT_PAID',
  'AWAITING_BALANCE',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
  'EXPIRED',
] as const;
export type OrderFinancialStatus = (typeof ORDER_FINANCIAL_STATUSES)[number];

export const ORDER_FULFILLMENT_STATUSES = [
  'UNFULFILLED',
  'AWAITING_IMPORT',
  'READY',
  'FULFILLED',
  'CANCELLED',
] as const;
export type OrderFulfillmentStatus = (typeof ORDER_FULFILLMENT_STATUSES)[number];

export const PAYMENT_PLANS = ['FULL', 'DEPOSIT_BALANCE'] as const;
export type PaymentPlanKind = (typeof PAYMENT_PLANS)[number];

export const ORDER_FINANCIAL_TRANSITIONS: Record<OrderFinancialStatus, OrderFinancialStatus[]> = {
  PENDING: ['DEPOSIT_PAID', 'PAID', 'FAILED', 'EXPIRED'],
  DEPOSIT_PAID: ['AWAITING_BALANCE', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  AWAITING_BALANCE: ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'],
  PAID: ['PARTIALLY_REFUNDED', 'REFUNDED'],
  PARTIALLY_REFUNDED: ['REFUNDED'],
  REFUNDED: [],
  FAILED: [],
  EXPIRED: [],
};

export function canTransitionOrderFinancial(from: OrderFinancialStatus, to: OrderFinancialStatus): boolean {
  return ORDER_FINANCIAL_TRANSITIONS[from].includes(to);
}

export const PAYMENT_KINDS = ['DEPOSIT', 'BALANCE', 'FULL', 'REFUND'] as const;
export const PAYMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'REFUNDED', 'CANCELLED'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['REFUNDED'],
  REJECTED: [],
  CANCELLED: [],
  REFUNDED: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export const CHECKOUT_PAYMENT_METHODS = ['mercadopago', 'uala', 'bank_transfer', 'cash'] as const;
export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

/** Pasarelas de tarjeta. La activa se elige por configuración, no por código. */
export const CARD_PAYMENT_METHODS = ['mercadopago', 'uala'] as const;
export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];

/** Métodos offline (sin pasarela): la tienda los confirma a mano al recibir el pago. */
export const OFFLINE_PAYMENT_METHODS = ['bank_transfer', 'cash'] as const;

export const PAYMENT_METHOD_LABELS: Record<CheckoutPaymentMethod, string> = {
  mercadopago: 'Mercado Pago',
  uala: 'Ualá',
  bank_transfer: 'Transferencia bancaria',
  cash: 'Efectivo (al retirar)',
};

// ---------------------------------------------------------------------------
// Checkout: lo que manda el storefront
// ---------------------------------------------------------------------------

export const checkoutContactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().min(6).max(30).optional(),
});
export type CheckoutContact = z.infer<typeof checkoutContactSchema>;

export const checkoutShippingSchema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('pickup') }),
  z.object({
    method: z.literal('delivery'),
    street: z.string().min(1).max(160),
    number: z.string().max(20).optional(),
    floor: z.string().max(40).optional(),
    city: z.string().min(1).max(120),
    province: z.string().min(1).max(120),
    postalCode: z.string().min(1).max(20),
    notes: z.string().max(300).optional(),
  }),
]);
export type CheckoutShipping = z.infer<typeof checkoutShippingSchema>;

export const createOrderSchema = z.object({
  contact: checkoutContactSchema,
  shipping: checkoutShippingSchema,
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS),
  notes: z.string().max(500).optional(),
  // El código se revalida y aplica en el servidor; nunca se confía en el descuento
  // calculado en el cliente.
  couponCode: z.string().trim().min(1).max(40).optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const retryPaymentSchema = z.object({
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS),
});
export type RetryPaymentInput = z.infer<typeof retryPaymentSchema>;

export const createOrderResponseSchema = z.object({
  orderId: z.string().uuid(),
  orderToken: z.string().min(32),
  displayNumber: z.string(),
  paymentMethod: z.enum(CHECKOUT_PAYMENT_METHODS),
  redirectUrl: z.string().nullable(),
  bankTransferInstructions: z.string().nullable(),
  dueTodayCents: z.number().int(),
});
export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;

// ---------------------------------------------------------------------------
// Lectura de pedidos
// ---------------------------------------------------------------------------

export const orderItemCustomizationDtoSchema = z.object({
  playerName: z.string().nullable(),
  playerNumber: z.number().int().nullable(),
  extraCents: z.number().int(),
  previewImageUrl: z.string().nullable(),
  productionImageUrl: z.string().nullable(),
});

export const orderItemDtoSchema = z.object({
  id: z.string().uuid(),
  productName: z.string(),
  variantSku: z.string(),
  optionsLabel: z.string().nullable(),
  imageUrl: z.string().nullable(),
  unitPriceCents: z.number().int(),
  quantity: z.number().int(),
  totalCents: z.number().int(),
  fulfillmentMode: z.enum(FULFILLMENT_MODES),
  customization: orderItemCustomizationDtoSchema.nullable(),
});
export type OrderItemDto = z.infer<typeof orderItemDtoSchema>;

export const orderEventDtoSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  message: z.string().nullable(),
  createdAt: z.string(),
});
export type OrderEventDto = z.infer<typeof orderEventDtoSchema>;

export const orderPaymentDtoSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(PAYMENT_KINDS),
  provider: z.string(),
  amountCents: z.number().int(),
  status: z.enum(PAYMENT_STATUSES),
  createdAt: z.string(),
});
export type OrderPaymentDto = z.infer<typeof orderPaymentDtoSchema>;

/** Vista mínima para la persona que posee el enlace secreto del pedido. */
export const publicOrderDetailSchema = z.object({
  displayNumber: z.string(),
  contactName: z.string(),
  paymentPlan: z.enum(PAYMENT_PLANS),
  financialStatus: z.enum(ORDER_FINANCIAL_STATUSES),
  fulfillmentStatus: z.enum(ORDER_FULFILLMENT_STATUSES),
  totalCents: z.number().int(),
  balanceCents: z.number().int().nullable(),
  payments: z.array(orderPaymentDtoSchema),
});
export type PublicOrderDetailDto = z.infer<typeof publicOrderDetailSchema>;

export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  number: z.number().int(),
  displayNumber: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  paymentPlan: z.enum(PAYMENT_PLANS),
  financialStatus: z.enum(ORDER_FINANCIAL_STATUSES),
  fulfillmentStatus: z.enum(ORDER_FULFILLMENT_STATUSES),
  totalCents: z.number().int(),
  createdAt: z.string(),
});
export type OrderSummaryDto = z.infer<typeof orderSummarySchema>;

export const orderDetailSchema = orderSummarySchema.extend({
  contactPhone: z.string().nullable(),
  pickupInStore: z.boolean(),
  shippingStreet: z.string().nullable(),
  shippingNumber: z.string().nullable(),
  shippingFloor: z.string().nullable(),
  shippingCity: z.string().nullable(),
  shippingProvince: z.string().nullable(),
  shippingPostalCode: z.string().nullable(),
  shippingNotes: z.string().nullable(),
  subtotalCents: z.number().int(),
  depositCents: z.number().int().nullable(),
  balanceCents: z.number().int().nullable(),
  shippingCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  items: z.array(orderItemDtoSchema),
  events: z.array(orderEventDtoSchema),
  payments: z.array(orderPaymentDtoSchema),
  shipment: shipmentDtoSchema.nullable(),
});
export type OrderDetailDto = z.infer<typeof orderDetailSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;

export const refundOrderSchema = z.object({
  amountCents: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional(),
});
export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export { createShipmentSchema, updateShipmentSchema };
export type { CreateShipmentInput, UpdateShipmentInput } from '../shipping/shipping.schema';

/** Número de pedido legible para mostrarle al cliente/clienta, ej: 1 -> "#1001". */
export function formatOrderNumber(number: number): string {
  return `#${1000 + number}`;
}
