import { Injectable, NotFoundException } from '@nestjs/common';
import type { SetCollectionProductsInput, UpsertCollectionInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const rows = await this.prisma.collection.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      position: c.position,
      productCount: c._count.products,
    }));
  }

  /** Colección con los IDs de sus productos, en orden, para editarla en el panel. */
  async get(id: string) {
    const collection = await this.prisma.collection.findUnique({
      where: { id },
      include: { products: { orderBy: { position: 'asc' }, select: { productId: true } } },
    });
    if (!collection) {
      throw new NotFoundException('La colección no existe');
    }
    return {
      id: collection.id,
      name: collection.name,
      slug: collection.slug,
      description: collection.description,
      imageUrl: collection.imageUrl,
      position: collection.position,
      productIds: collection.products.map((p) => p.productId),
    };
  }

  create(input: UpsertCollectionInput) {
    return this.prisma.collection.create({
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        position: input.position ?? 0,
      },
    });
  }

  update(id: string, input: UpsertCollectionInput) {
    return this.prisma.collection.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        imageUrl: input.imageUrl ?? null,
        position: input.position ?? 0,
      },
    });
  }

  remove(id: string) {
    return this.prisma.collection.delete({ where: { id } });
  }

  /** Reemplaza por completo el set de productos de la colección, conservando el orden dado. */
  async setProducts(id: string, input: SetCollectionProductsInput) {
    await this.prisma.collection.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('La colección no existe');
    });

    await this.prisma.$transaction([
      this.prisma.productCollection.deleteMany({ where: { collectionId: id } }),
      this.prisma.productCollection.createMany({
        data: input.productIds.map((productId, index) => ({ collectionId: id, productId, position: index })),
        skipDuplicates: true,
      }),
    ]);

    return { count: input.productIds.length };
  }
}
