import { Injectable } from '@nestjs/common';
import { applyBulkPrice, type BulkPriceAdjustmentInput, type BulkPricePreviewDto } from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

/** Cuántas variantes se actualizan por lote. */
const TAMANO_LOTE = 500;

@Injectable()
export class BulkPricingService {
  constructor(private readonly prisma: PrismaService) {}

  private where(input: BulkPriceAdjustmentInput): Prisma.ProductVariantWhereInput {
    return {
      product: {
        status: 'ACTIVE',
        ...(input.leagueId ? { leagueId: input.leagueId } : {}),
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      },
    };
  }

  /**
   * Qué pasaría si se aplicara. No escribe nada: es el paso obligatorio antes
   * de tocar el precio de todo el catálogo.
   */
  async preview(input: BulkPriceAdjustmentInput): Promise<BulkPricePreviewDto> {
    const where = this.where(input);

    const [variantes, productosAfectados, muestra] = await Promise.all([
      this.prisma.productVariant.findMany({ where, select: { priceCents: true } }),
      this.prisma.product
        .findMany({ where: this.where(input).product as Prisma.ProductWhereInput, select: { id: true } })
        .then((r) => r.length),
      this.prisma.productVariant.findMany({
        where,
        select: { sku: true, priceCents: true, product: { select: { name: true } } },
        orderBy: { priceCents: 'desc' },
        take: 8,
      }),
    ]);

    let totalAntes = 0;
    let totalDespues = 0;
    for (const v of variantes) {
      totalAntes += v.priceCents;
      totalDespues += applyBulkPrice(v.priceCents, input);
    }

    return {
      variantesAfectadas: variantes.length,
      productosAfectados,
      ejemplos: muestra.map((v) => ({
        producto: v.product.name,
        sku: v.sku,
        antes: v.priceCents,
        despues: applyBulkPrice(v.priceCents, input),
      })),
      totalAntes,
      totalDespues,
    };
  }

  /**
   * Aplica el ajuste. Va por lotes en vez de una sola sentencia porque el
   * cálculo (porcentaje + redondeo + piso) vive en código compartido con el
   * panel: replicarlo en SQL sería una segunda versión que puede divergir.
   *
   * Queda registrado en `audit_logs`: es una operación que cambia miles de
   * precios y hay que poder saber quién la corrió y con qué parámetros.
   */
  async apply(input: BulkPriceAdjustmentInput, staffUserId: string | null) {
    const where = this.where(input);
    const resumen = await this.preview(input);

    let actualizadas = 0;
    let desde = 0;

    for (;;) {
      const lote = await this.prisma.productVariant.findMany({
        where,
        select: { id: true, priceCents: true },
        orderBy: { id: 'asc' },
        take: TAMANO_LOTE,
        skip: desde,
      });
      if (lote.length === 0) break;

      const cambios = lote
        .map((v) => ({ id: v.id, anterior: v.priceCents, nuevo: applyBulkPrice(v.priceCents, input) }))
        .filter((c) => c.nuevo !== c.anterior);

      if (cambios.length > 0) {
        await this.prisma.$transaction(
          cambios.map((c) =>
            this.prisma.productVariant.update({ where: { id: c.id }, data: { priceCents: c.nuevo } }),
          ),
        );
        actualizadas += cambios.length;
      }
      desde += lote.length;
    }

    await this.prisma.auditLog.create({
      data: {
        staffUserId,
        action: 'BULK_PRICE_ADJUSTMENT',
        entityType: 'ProductVariant',
        metadata: {
          ...input,
          variantesActualizadas: actualizadas,
          totalAntes: resumen.totalAntes,
          totalDespues: resumen.totalDespues,
        },
      },
    });

    return { ...resumen, variantesActualizadas: actualizadas };
  }

  /**
   * Los precios más usados del catálogo, para mostrar ejemplos reales en vez de
   * números fijos que envejecen. Se excluye el cero: son variantes mal cargadas,
   * no un precio que valga la pena ilustrar.
   */
  async samplePrices(cantidad = 3): Promise<number[]> {
    const grupos = await this.prisma.productVariant.groupBy({
      by: ['priceCents'],
      where: { product: { status: 'ACTIVE' }, priceCents: { gt: 0 } },
      _count: { _all: true },
      orderBy: { _count: { priceCents: 'desc' } },
      take: cantidad,
    });
    return grupos.map((g) => g.priceCents).sort((a, b) => a - b);
  }

  /** Últimos ajustes corridos, para que quede a la vista qué se hizo. */
  async history() {
    const filas = await this.prisma.auditLog.findMany({
      where: { action: 'BULK_PRICE_ADJUSTMENT' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { staffUser: { select: { email: true } } },
    });
    return filas.map((f) => ({
      id: f.id,
      createdAt: f.createdAt.toISOString(),
      porQuien: f.staffUser?.email ?? null,
      detalle: f.metadata,
    }));
  }
}
