import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BulkUpdateVariantsInput,
  ProductDetailDto,
  ReplaceProductOptionsInput,
  UpsertProductInput,
  UpsertVariantInput,
} from '@tienda/shared';
import { MAX_PRODUCT_OPTIONS } from '@tienda/shared';
import type { Prisma, ProductStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from '../customization/templates.service';
import { combinationKey, generateVariantCombinations, suggestSku } from './variant-generator';

const PRODUCT_DETAIL_INCLUDE = {
  brand: true,
  category: true,
  league: true,
  team: true,
  season: true,
  options: { include: { values: true }, orderBy: { position: 'asc' as const } },
  images: { orderBy: { position: 'asc' as const } },
  variants: {
    include: { optionValues: true, inventory: true },
    orderBy: { position: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_INCLUDE }>;

interface AdminListFilters {
  status?: string;
  q?: string;
  page: number;
  perPage: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  async listForAdmin(filters: AdminListFilters) {
    const where: Prisma.ProductWhereInput = {
      ...(filters.status ? { status: filters.status as ProductStatus } : {}),
      ...(filters.q ? { name: { contains: filters.q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (filters.page - 1) * filters.perPage,
        take: filters.perPage,
        include: {
          brand: true,
          league: true,
          team: true,
          images: { orderBy: { position: 'asc' }, take: 1 },
          variants: {
            orderBy: { position: 'asc' },
            select: {
              priceCents: true,
              inventory: true,
              optionValues: { select: { value: { select: { value: true } } } },
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: items.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        status: p.status,
        fulfillmentMode: p.fulfillmentMode,
        brandName: p.brand?.name ?? null,
        leagueName: p.league?.name ?? null,
        teamName: p.team?.name ?? null,
        coverImageUrl: p.images[0]?.url ?? null,
        variantCount: p.variants.length,
        totalStock: p.variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0),
        // Desglose de stock por talle (o combinación) para mostrarlo en la lista.
        stockByVariant: p.variants.map((v) => ({
          label: v.optionValues.map((ov) => ov.value.value).join(' / ') || 'Único',
          quantity: v.inventory?.quantity ?? 0,
        })),
        minPriceCents: p.variants.length ? Math.min(...p.variants.map((v) => v.priceCents)) : null,
      })),
      page: filters.page,
      perPage: filters.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.perPage)),
    };
  }

  async getDetail(id: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }
    return this.toDetailDto(product);
  }

  /** Convierte un nombre en un slug URL-friendly (sin acentos ni símbolos). */
  private slugify(name: string): string {
    const base = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '');
    return base || 'producto';
  }

  /** Slug único: si ya existe, agrega -2, -3, … (excluyendo el propio producto). */
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    let slug = base;
    let n = 2;
    for (;;) {
      const existing = await this.prisma.product.findFirst({
        where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { id: true },
      });
      if (!existing) return slug;
      slug = `${base}-${n++}`;
    }
  }

  async create(input: UpsertProductInput): Promise<ProductDetailDto> {
    // El slug sigue al nombre: se genera server-side y se ignora el que venga del form.
    const slug = await this.uniqueSlug(this.slugify(input.name));
    const product = await this.prisma.product.create({
      data: { ...input, slug },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    return this.toDetailDto(product);
  }

  async update(id: string, input: UpsertProductInput): Promise<ProductDetailDto> {
    // Cada vez que cambia el nombre, el slug se regenera automáticamente.
    const slug = await this.uniqueSlug(this.slugify(input.name), id);
    const product = await this.prisma.product.update({
      where: { id },
      data: { ...input, slug },
      include: PRODUCT_DETAIL_INCLUDE,
    });
    return this.toDetailDto(product);
  }

  async remove(id: string) {
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }

  /**
   * Aplica contenido generado por IA (nombre y/o descripción). Si cambia el
   * nombre, regenera el slug único. Usado por el proceso masivo de nombres.
   */
  async applyGeneratedContent(id: string, data: { name?: string; description?: string }) {
    const patch: Prisma.ProductUpdateInput = {};
    if (data.name) {
      patch.name = data.name;
      patch.slug = await this.uniqueSlug(this.slugify(data.name), id);
    }
    if (data.description !== undefined) {
      patch.description = data.description;
    }
    if (Object.keys(patch).length === 0) return;
    await this.prisma.product.update({ where: { id }, data: patch });
  }

  async replaceOptions(id: string, input: ReplaceProductOptionsInput): Promise<ProductDetailDto> {
    if (input.options.length > MAX_PRODUCT_OPTIONS) {
      throw new BadRequestException(`Un producto admite hasta ${MAX_PRODUCT_OPTIONS} opciones`);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.productOption.deleteMany({ where: { productId: id } });
      for (const [optionIndex, option] of input.options.entries()) {
        await tx.productOption.create({
          data: {
            productId: id,
            name: option.name,
            position: option.position ?? optionIndex,
            values: {
              create: option.values.map((value, valueIndex) => ({
                value: value.value,
                position: value.position ?? valueIndex,
              })),
            },
          },
        });
      }
    });

    return this.getDetail(id);
  }

  async generateVariants(id: string): Promise<ProductDetailDto> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        options: { include: { values: true }, orderBy: { position: 'asc' } },
        variants: { include: { optionValues: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const combinations = generateVariantCombinations(
      product.options.map((o) => ({ id: o.id, values: o.values.map((v) => ({ id: v.id, value: v.value })) })),
    );

    const existingKeys = new Set(
      product.variants.map((v) => combinationKey(v.optionValues.map((ov) => ov.valueId))),
    );

    const toCreate = combinations.filter((combo) => !existingKeys.has(combinationKey(combo.optionValueIds)));

    if (toCreate.length > 0) {
      await this.prisma.$transaction(
        toCreate.map((combo, index) =>
          this.prisma.productVariant.create({
            data: {
              productId: id,
              sku: `${suggestSku(product.slug, combo.labels)}-${randomUUID().slice(0, 4).toUpperCase()}`,
              priceCents: 0,
              position: product.variants.length + index,
              optionValues: { create: combo.optionValueIds.map((valueId) => ({ valueId })) },
              // Si el producto admite encargo (PREORDER o BOTH) las variantes nacen
              // con "por encargo" tildado; igual se les puede cargar stock local.
              inventory: { create: { quantity: 0, allowPreorder: product.fulfillmentMode !== 'IN_STOCK' } },
            },
          }),
        ),
      );
    }

    return this.getDetail(id);
  }

  async updateVariant(productId: string, variantId: string, input: Partial<UpsertVariantInput>) {
    const { quantity, trackInventory, allowPreorder, preorderLeadDays, ...variantFields } = input;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(variantFields).length > 0) {
        await tx.productVariant.update({
          where: { id: variantId, productId },
          data: variantFields,
        });
      }

      const inventoryData: Prisma.InventoryItemUpdateInput = {};
      if (quantity !== undefined) inventoryData.quantity = quantity;
      if (trackInventory !== undefined) inventoryData.trackInventory = trackInventory;
      if (allowPreorder !== undefined) inventoryData.allowPreorder = allowPreorder;
      if (preorderLeadDays !== undefined) inventoryData.preorderLeadDays = preorderLeadDays;

      if (Object.keys(inventoryData).length > 0) {
        await tx.inventoryItem.upsert({
          where: { variantId },
          create: { variantId, quantity: quantity ?? 0, trackInventory, allowPreorder, preorderLeadDays },
          update: inventoryData,
        });
      }
    });

    return this.getDetail(productId);
  }

  async bulkUpdateVariants(productId: string, input: BulkUpdateVariantsInput) {
    for (const variant of input.variants) {
      const { id, ...rest } = variant;
      await this.updateVariant(productId, id, rest);
    }
    return this.getDetail(productId);
  }

  async removeVariant(productId: string, variantId: string) {
    await this.prisma.productVariant.delete({ where: { id: variantId, productId } });
    return this.getDetail(productId);
  }

  async attachImage(productId: string, url: string, alt: string | null) {
    const lastPosition = await this.prisma.productImage.count({ where: { productId } });
    await this.prisma.productImage.create({
      data: { productId, url, alt, position: lastPosition },
    });
    return this.getDetail(productId);
  }

  async updateImage(
    productId: string,
    imageId: string,
    input: { alt?: string | null; optionValueId?: string | null },
  ) {
    await this.prisma.productImage.update({
      where: { id: imageId, productId },
      data: input,
    });
    return this.getDetail(productId);
  }

  async reorderImages(productId: string, imageIds: string[]) {
    await this.prisma.$transaction(
      imageIds.map((imageId, position) =>
        this.prisma.productImage.update({
          where: { id: imageId, productId },
          data: { position },
        }),
      ),
    );
    return this.getDetail(productId);
  }

  async removeImage(productId: string, imageId: string) {
    await this.prisma.productImage.delete({ where: { id: imageId, productId } });
    return this.getDetail(productId);
  }

  private async toDetailDto(product: ProductWithRelations): Promise<ProductDetailDto> {
    const customization = await this.templates.get(product.id);
    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      description: product.description,
      status: product.status,
      fulfillmentMode: product.fulfillmentMode,
      preorderLeadDays: product.preorderLeadDays,
      brandId: product.brandId,
      categoryId: product.categoryId,
      leagueId: product.leagueId,
      teamId: product.teamId,
      seasonId: product.seasonId,
      sizeGuideId: product.sizeGuideId,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      position: product.position,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      publishedAt: product.publishedAt?.toISOString() ?? null,
      brand: product.brand ? { id: product.brand.id, name: product.brand.name, slug: product.brand.slug } : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name, slug: product.category.slug }
        : null,
      league: product.league
        ? { id: product.league.id, name: product.league.name, slug: product.league.slug }
        : null,
      team: product.team ? { id: product.team.id, name: product.team.name, slug: product.team.slug } : null,
      season: product.season ? { id: product.season.id, label: product.season.label } : null,
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        position: option.position,
        values: option.values.map((value) => ({ id: value.id, value: value.value, position: value.position })),
      })),
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        alt: image.alt,
        position: image.position,
        optionValueId: image.optionValueId,
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        priceCents: variant.priceCents,
        compareAtPriceCents: variant.compareAtPriceCents,
        costCents: variant.costCents,
        weightGrams: variant.weightGrams,
        barcode: variant.barcode,
        position: variant.position,
        optionValueIds: variant.optionValues.map((ov) => ov.valueId),
        inventory: {
          quantity: variant.inventory?.quantity ?? 0,
          reserved: variant.inventory?.reserved ?? 0,
          available: (variant.inventory?.quantity ?? 0) - (variant.inventory?.reserved ?? 0),
          trackInventory: variant.inventory?.trackInventory ?? true,
          allowPreorder: variant.inventory?.allowPreorder ?? false,
          preorderLeadDays: variant.inventory?.preorderLeadDays ?? null,
        },
      })),
      customization,
    };
  }
}
