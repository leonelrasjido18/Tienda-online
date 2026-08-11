import { z } from 'zod';

export const REVIEW_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const createReviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(3, 'Contanos un poco más').max(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

/** Reseña pública (aprobada): sin datos internos del cliente más allá del nombre. */
export const publicReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
});
export type PublicReviewDto = z.infer<typeof publicReviewSchema>;

export const reviewSummarySchema = z.object({
  average: z.number(),
  count: z.number().int(),
  reviews: z.array(publicReviewSchema),
});
export type ReviewSummaryDto = z.infer<typeof reviewSummarySchema>;

/** Reseña para moderación en el panel (incluye producto, autor y estado). */
export const adminReviewSchema = z.object({
  id: z.string().uuid(),
  rating: z.number().int(),
  title: z.string().nullable(),
  body: z.string(),
  status: z.enum(REVIEW_STATUSES),
  authorName: z.string(),
  authorEmail: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  createdAt: z.string(),
});
export type AdminReviewDto = z.infer<typeof adminReviewSchema>;
