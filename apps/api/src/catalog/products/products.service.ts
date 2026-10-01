import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  BulkUpdateVariantsInput,
  ProductDetailDto,
  QuickVariantSetupInput,
  ReplaceProductOptionsInput,
  UpsertProductInput,
  UpsertVariantInput,
} from '@tienda/shared';
import {
  MAX_PRODUCT_OPTIONS,
  SLEEVE_LONG_VALUE,
  SLEEVE_OPTION_NAME,
  SLEEVE_SHORT_VALUE,
} from '@tienda/shared';
import type { Prisma, ProductStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { TemplatesService } from '../customization/templates.service';
import {
  combinationKey,
  generateVariantCombinations,
  optionValueKey,
  planVariantRelink,
  suggestSku,
} from './variant-generator';

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
      // Qué combinación tenía cada variante ANTES de tocar las opciones. Borrar
      // una opción arrastra sus valores y, por cascada, los enlaces de las
      // variantes: sin este rescate las variantes quedan vivas pero huérfanas,
      // sin talle, imposibles de comprar y mostrando "(sin talle)" en la grilla.
      const previas = await tx.productVariant.findMany({
        where: { productId: id },
        select: {
          id: true,
          optionValues: { select: { value: { select: { value: true, option: { select: { name: true } } } } } },
        },
      });
      const combinacionPrevia = previas.map((v) => ({
        variantId: v.id,
        claves: v.optionValues.map((ov) => optionValueKey(ov.value.option.name, ov.value.value)),
      }));

      // Las fotos también se atan a un valor de opción (es lo que hace que la
      // ficha cambie la foto al elegir "Manga: Larga"). Ese vínculo es SetNull,
      // así que sin rescatarlo se pierde en silencio cada vez que se guardan
      // las opciones, aunque no se haya cambiado nada.
      const fotosPrevias = await tx.productImage.findMany({
        where: { productId: id, optionValueId: { not: null } },
        select: { id: true, optionValue: { select: { value: true, option: { select: { name: true } } } } },
      });
      const claveDeFoto = new Map(
        fotosPrevias
          .filter((f) => f.optionValue)
          .map((f) => [f.id, optionValueKey(f.optionValue!.option.name, f.optionValue!.value)]),
      );

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

      if (previas.length === 0) return;

      // Se reconstruyen los enlaces contra los valores nuevos, emparejando por
      // nombre de opción y texto del valor. Renombrar o reordenar no pierde nada;
      // cambiar los valores sí, y esas variantes ya no representan nada.
      const nuevos = await tx.productOptionValue.findMany({
        where: { option: { productId: id } },
        select: { id: true, value: true, optionId: true, option: { select: { name: true } } },
      });
      const { enlaces, huerfanas } = planVariantRelink(
        combinacionPrevia,
        nuevos.map((v) => ({ id: v.id, optionId: v.optionId, clave: optionValueKey(v.option.name, v.value) })),
      );

      if (enlaces.length > 0) {
        await tx.variantOptionValue.createMany({ data: enlaces, skipDuplicates: true });
      }

      // Las que no se pudieron reconstruir se borran: dejarlas era justamente el
      // bug. `OrderItem.variantId` es SetNull, así que los pedidos ya hechos
      // conservan nombre, SKU y precio congelados.
      if (huerfanas.length > 0) {
        await tx.productVariant.deleteMany({ where: { id: { in: huerfanas } } });
      }

      // Se reatan las fotos cuyo valor sigue existiendo. Las que apuntaban a un
      // valor eliminado quedan sin atar, que es lo correcto: ese valor ya no se
      // puede elegir.
      const valorPorClave = new Map(
        nuevos.map((v) => [optionValueKey(v.option.name, v.value), v.id] as const),
      );
      for (const [imageId, clave] of claveDeFoto) {
        const valueId = valorPorClave.get(clave);
        if (valueId) {
          await tx.productImage.update({ where: { id: imageId }, data: { optionValueId: valueId } });
        }
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

  /**
   * Arma talles (y manga, si corresponde), genera todas las combinaciones y les
   * pone precio y stock de una vez.
   *
   * Existe porque hacerlo a mano eran tres pasos —guardar opciones, generar
   * variantes, completar la grilla— y `generateVariants` crea todo a precio 0:
   * si te olvidabas del tercero, el producto quedaba publicado a $0.
   */
  async quickVariantSetup(productId: string, input: QuickVariantSetupInput): Promise<ProductDetailDto> {
    const talles = [...new Set(input.sizes.map((s) => s.trim()).filter(Boolean))];
    if (talles.length === 0) {
      throw new BadRequestException('Hay que indicar al menos un talle');
    }

    const options: ReplaceProductOptionsInput['options'] = [
      { name: 'Talle', position: 0, values: talles.map((value, position) => ({ value, position })) },
    ];
    if (input.withLongSleeve) {
      options.push({
        name: SLEEVE_OPTION_NAME,
        position: 1,
        values: [
          { value: SLEEVE_SHORT_VALUE, position: 0 },
          { value: SLEEVE_LONG_VALUE, position: 1 },
        ],
      });
    }

    await this.replaceOptions(productId, { options });
    await this.generateVariants(productId);

    // El precio se decide por variante: la manga larga sale más cara. Se mira el
    // valor enlazado y no el SKU, que es texto generado y puede cambiar.
    const variantes = await this.prisma.productVariant.findMany({
      where: { productId },
      select: {
        id: true,
        optionValues: { select: { value: { select: { value: true, option: { select: { name: true } } } } } },
      },
    });

    const precioLargas = input.longSleevePriceCents ?? input.priceCents;
    for (const variante of variantes) {
      const esLarga = variante.optionValues.some(
        (ov) =>
          ov.value.option.name.trim().toLowerCase() === SLEEVE_OPTION_NAME.toLowerCase() &&
          ov.value.value.trim().toLowerCase() === SLEEVE_LONG_VALUE.toLowerCase(),
      );
      await this.updateVariant(productId, variante.id, {
        priceCents: esLarga ? precioLargas : input.priceCents,
        quantity: input.quantity,
        trackInventory: input.trackInventory,
        allowPreorder: input.allowPreorder,
      });
    }

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
    input: { alt?: string | null; optionValueId?: string | null; isLongSleeve?: boolean },
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
        isLongSleeve: image.isLongSleeve,
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
