import { Injectable, NotFoundException } from '@nestjs/common';
import type { PrintArea, ProductCustomizationDto, UpsertCustomizationTemplateInput } from '@tienda/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const TEMPLATE_INCLUDE = {
  font: true,
  patchOptions: { include: { patch: { include: { leagues: true } } } },
} satisfies Prisma.CustomizationTemplateInclude;

type TemplateWithRelations = Prisma.CustomizationTemplateGetPayload<{ include: typeof TEMPLATE_INCLUDE }>;

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(productId: string): Promise<ProductCustomizationDto | null> {
    const template = await this.prisma.customizationTemplate.findUnique({
      where: { productId },
      include: TEMPLATE_INCLUDE,
    });
    return template ? this.toDto(template) : null;
  }

  async upsert(productId: string, input: UpsertCustomizationTemplateInput): Promise<ProductCustomizationDto> {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const baseData = {
      enableName: input.enableName,
      enableNumber: input.enableNumber,
      enablePatches: input.enablePatches,
      maxNameLength: input.maxNameLength,
      minNumber: input.minNumber,
      maxNumber: input.maxNumber,
      nameExtraCents: input.nameExtraCents,
      numberExtraCents: input.numberExtraCents,
      fontId: input.fontId ?? null,
      namePrintArea: input.namePrintArea,
      numberPrintArea: input.numberPrintArea,
      patchPrintArea: input.patchPrintArea ?? Prisma.JsonNull,
    };

    const existing = await this.prisma.customizationTemplate.findUnique({ where: { productId } });
    const template = existing
      ? await this.prisma.customizationTemplate.update({ where: { productId }, data: baseData })
      : await this.prisma.customizationTemplate.create({ data: { ...baseData, productId } });

    await this.prisma.productCustomizationOption.deleteMany({ where: { templateId: template.id } });
    if (input.patchIds.length > 0) {
      await this.prisma.productCustomizationOption.createMany({
        data: input.patchIds.map((patchId) => ({ templateId: template.id, patchId })),
      });
    }

    const result = await this.get(productId);
    if (!result) {
      throw new NotFoundException('No se pudo guardar la personalización');
    }
    return result;
  }

  async remove(productId: string) {
    await this.prisma.customizationTemplate.deleteMany({ where: { productId } });
    return { success: true };
  }

  private toDto(template: TemplateWithRelations): ProductCustomizationDto {
    return {
      id: template.id,
      productId: template.productId,
      enableName: template.enableName,
      enableNumber: template.enableNumber,
      enablePatches: template.enablePatches,
      maxNameLength: template.maxNameLength,
      minNumber: template.minNumber,
      maxNumber: template.maxNumber,
      nameExtraCents: template.nameExtraCents,
      numberExtraCents: template.numberExtraCents,
      namePrintArea: template.namePrintArea as unknown as PrintArea,
      numberPrintArea: template.numberPrintArea as unknown as PrintArea,
      patchPrintArea: template.patchPrintArea as unknown as PrintArea | null,
      font: template.font
        ? {
            id: template.font.id,
            leagueId: template.font.leagueId,
            name: template.font.name,
            fontFileUrl: template.font.fontFileUrl,
            fillColor: template.font.fillColor,
            strokeColor: template.font.strokeColor,
            strokeWidthPx: template.font.strokeWidthPx,
            letterSpacingPx: template.font.letterSpacingPx,
          }
        : null,
      patches: template.patchOptions.map((po) => ({
        id: po.patch.id,
        name: po.patch.name,
        imageUrl: po.patch.imageUrl,
        priceCents: po.patch.priceCents,
        leagueIds: po.patch.leagues.map((l) => l.leagueId),
      })),
    };
  }
}
