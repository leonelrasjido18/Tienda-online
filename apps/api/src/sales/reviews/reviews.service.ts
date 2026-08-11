import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminReviewDto, CreateReviewInput, ReviewStatus, ReviewSummaryDto } from '@tienda/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Crea una reseña PENDING. Sólo la puede dejar quien compró el producto: se
   * exige un pedido PAID a nombre del email del cliente que incluya ese producto.
   * Una sola reseña por cliente y producto (la unique del schema lo garantiza).
   */
  async create(customer: { id: string; email: string }, input: CreateReviewInput) {
    const eligibleOrder = await this.prisma.order.findFirst({
      where: {
        contactEmail: { equals: customer.email, mode: 'insensitive' },
        financialStatus: 'PAID',
        items: { some: { variant: { productId: input.productId } } },
      },
      select: { id: true },
    });

    if (!eligibleOrder) {
      throw new ForbiddenException('Solo pueden dejar una reseña quienes compraron y recibieron este producto.');
    }

    try {
      await this.prisma.review.create({
        data: {
          productId: input.productId,
          customerId: customer.id,
          orderId: eligibleOrder.id,
          rating: input.rating,
          title: input.title ?? null,
          body: input.body,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('Ya dejaste una reseña para este producto.');
      }
      throw error;
    }

    return { success: true, status: 'PENDING' as const };
  }

  /** Resumen público (sólo aprobadas) de un producto por slug: promedio + lista. */
  async getSummaryBySlug(slug: string): Promise<ReviewSummaryDto> {
    const product = await this.prisma.product.findFirst({ where: { slug }, select: { id: true } });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const reviews = await this.prisma.review.findMany({
      where: { productId: product.id, status: 'APPROVED' },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const count = reviews.length;
    const average = count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0;

    return {
      average: Math.round(average * 10) / 10,
      count,
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        authorName: this.displayName(r.customer.name),
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  // --- moderación (panel) -------------------------------------------------

  async listForModeration(status?: ReviewStatus): Promise<AdminReviewDto[]> {
    const reviews = await this.prisma.review.findMany({
      where: status ? { status } : {},
      include: {
        customer: { select: { name: true, email: true } },
        product: { select: { name: true, slug: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      status: r.status,
      authorName: r.customer.name ?? 'Cliente',
      authorEmail: r.customer.email,
      productName: r.product.name,
      productSlug: r.product.slug,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async setStatus(id: string, status: ReviewStatus) {
    await this.prisma.review.update({ where: { id }, data: { status } });
    return { success: true, status };
  }

  /** Muestra el nombre de pila y la inicial del apellido (o "Cliente"). */
  private displayName(name: string | null): string {
    if (!name) return 'Cliente';
    const parts = name.trim().split(/\s+/);
    const first = parts[0] ?? 'Cliente';
    const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1]![0]!.toUpperCase()}.` : '';
    return `${first}${lastInitial}`;
  }
}
