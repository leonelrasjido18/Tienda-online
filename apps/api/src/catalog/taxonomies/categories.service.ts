import { Injectable } from '@nestjs/common';
import type { UpsertCategoryInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: { position: 'asc' } });
  }

  create(input: UpsertCategoryInput) {
    return this.prisma.category.create({ data: input });
  }

  update(id: string, input: UpsertCategoryInput) {
    return this.prisma.category.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.category.delete({ where: { id } });
  }
}
