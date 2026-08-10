import { z } from 'zod';

import { moneyCentsSchema } from '../catalog/common.schema';

export const IMPORT_BATCH_STATUSES = [
  'OPEN',
  'ORDERED',
  'IN_TRANSIT',
  'CUSTOMS',
  'RECEIVED',
  'CLOSED',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

/**
 * Avance permitido de estados. El lote sólo va hacia adelante: retroceder dejaría
 * pedidos con links de saldo ya emitidos en un estado inconsistente.
 */
export const IMPORT_BATCH_TRANSITIONS: Record<ImportBatchStatus, ImportBatchStatus[]> = {
  OPEN: ['ORDERED'],
  ORDERED: ['IN_TRANSIT'],
  IN_TRANSIT: ['CUSTOMS', 'RECEIVED'],
  CUSTOMS: ['RECEIVED'],
  RECEIVED: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(from: ImportBatchStatus, to: ImportBatchStatus): boolean {
  return IMPORT_BATCH_TRANSITIONS[from].includes(to);
}

/** Etiquetas para el panel y para lo que ve el cliente en el seguimiento. */
export const IMPORT_BATCH_STATUS_LABELS: Record<ImportBatchStatus, string> = {
  OPEN: 'Abierto',
  ORDERED: 'Pedido al proveedor',
  IN_TRANSIT: 'En tránsito',
  CUSTOMS: 'En aduana',
  RECEIVED: 'Recibido',
  CLOSED: 'Cerrado',
};

export const createImportBatchSchema = z.object({
  code: z.string().trim().min(3).max(40),
  supplier: z.string().trim().max(120).nullish(),
  closesAt: z.string().datetime().nullish(),
  etaDate: z.string().datetime().nullish(),
  notes: z.string().max(2000).nullish(),
});
export type CreateImportBatchInput = z.infer<typeof createImportBatchSchema>;

export const updateImportBatchSchema = z.object({
  supplier: z.string().trim().max(120).nullish(),
  closesAt: z.string().datetime().nullish(),
  etaDate: z.string().datetime().nullish(),
  trackingRef: z.string().trim().max(120).nullish(),
  freightCents: moneyCentsSchema.nullish(),
  customsCents: moneyCentsSchema.nullish(),
  otherfeeCents: moneyCentsSchema.nullish(),
  notes: z.string().max(2000).nullish(),
});
export type UpdateImportBatchInput = z.infer<typeof updateImportBatchSchema>;

export const advanceImportBatchSchema = z.object({
  status: z.enum(IMPORT_BATCH_STATUSES),
});
export type AdvanceImportBatchInput = z.infer<typeof advanceImportBatchSchema>;

export const assignOrdersSchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(500),
});
export type AssignOrdersInput = z.infer<typeof assignOrdersSchema>;

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

export const importBatchSummarySchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  supplier: z.string().nullable(),
  status: z.enum(IMPORT_BATCH_STATUSES),
  closesAt: z.string().nullable(),
  etaDate: z.string().nullable(),
  receivedAt: z.string().nullable(),
  orderCount: z.number().int(),
  /** Suma de saldos pendientes de los pedidos del lote. */
  pendingBalanceCents: z.number().int(),
  createdAt: z.string(),
});
export type ImportBatchSummaryDto = z.infer<typeof importBatchSummarySchema>;

export const importBatchOrderSchema = z.object({
  id: z.string().uuid(),
  displayNumber: z.string(),
  contactName: z.string(),
  contactEmail: z.string(),
  balanceCents: z.number().int().nullable(),
  shippingCents: z.number().int().nullable(),
  financialStatus: z.string(),
  province: z.string().nullable(),
  pickupInStore: z.boolean(),
  itemCount: z.number().int(),
});
export type ImportBatchOrderDto = z.infer<typeof importBatchOrderSchema>;

export const importBatchDetailSchema = importBatchSummarySchema.extend({
  trackingRef: z.string().nullable(),
  freightCents: z.number().int().nullable(),
  customsCents: z.number().int().nullable(),
  otherfeeCents: z.number().int().nullable(),
  notes: z.string().nullable(),
  orders: z.array(importBatchOrderSchema),
  events: z.array(
    z.object({
      id: z.string().uuid(),
      type: z.string(),
      message: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
});
export type ImportBatchDetailDto = z.infer<typeof importBatchDetailSchema>;
