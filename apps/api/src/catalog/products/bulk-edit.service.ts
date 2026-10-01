import { Injectable } from '@nestjs/common';
import type { BulkEditFilter, BulkEditInput, BulkEditPreviewDto } from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BulkEditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Traduce los filtros del panel a una condición de Prisma.
   *
   * Los filtros "sin liga / sin equipo / sin foto" son los que hacen útil esto:
   * sirven para encontrar lo que quedó a medio cargar y arreglarlo de una.
   */
  private where(filtro: BulkEditFilter): Prisma.ProductWhereInput {
    const where: Prisma.ProductWhereInput = {};

    if (filtro.status) where.status = filtro.status;
    if (filtro.leagueId) where.leagueId = filtro.leagueId;
    if (filtro.teamId) where.teamId = filtro.teamId;
    if (filtro.categoryId) where.categoryId = filtro.categoryId;
    if (filtro.q) where.name = { contains: filtro.q, mode: 'insensitive' };
    if (filtro.sinLiga) where.leagueId = null;
    if (filtro.sinEquipo) where.teamId = null;
    if (filtro.sinFoto) where.images = { none: {} };

    return where;
  }

  /** No escribe nada: es el paso obligatorio antes de tocar el catálogo. */
  async preview(input: BulkEditInput): Promise<BulkEditPreviewDto> {
    const where = this.where(input.filtro);
    const [afectados, ejemplos] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({ where, select: { id: true, name: true }, take: 8, orderBy: { name: 'asc' } }),
    ]);
    return { afectados, ejemplos };
  }

  /**
   * Aplica los cambios. Sólo se escriben los campos presentes: un `null` en el
   * cuerpo significa "no lo toques", no "ponelo en vacío".
   */
  async apply(input: BulkEditInput, staffUserId: string | null) {
    const where = this.where(input.filtro);
    const { afectados } = await this.preview(input);

    const data: Prisma.ProductUpdateManyMutationInput = {};
    const { cambios } = input;
    if (cambios.status) data.status = cambios.status;
    if (cambios.fulfillmentMode) data.fulfillmentMode = cambios.fulfillmentMode;
    // Las relaciones van por id directo porque updateMany no admite `connect`.
    const relaciones: Record<string, string> = {};
    if (cambios.leagueId) relaciones.leagueId = cambios.leagueId;
    if (cambios.teamId) relaciones.teamId = cambios.teamId;
    if (cambios.categoryId) relaciones.categoryId = cambios.categoryId;
    if (cambios.seasonId) relaciones.seasonId = cambios.seasonId;

    const resultado = await this.prisma.product.updateMany({
      where,
      data: { ...data, ...relaciones },
    });

    await this.prisma.auditLog.create({
      data: {
        staffUserId,
        action: 'BULK_PRODUCT_EDIT',
        entityType: 'Product',
        metadata: { filtro: input.filtro, cambios: input.cambios, actualizados: resultado.count },
      },
    });

    return { afectados, actualizados: resultado.count };
  }

  async history() {
    const filas = await this.prisma.auditLog.findMany({
      where: { action: 'BULK_PRODUCT_EDIT' },
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
