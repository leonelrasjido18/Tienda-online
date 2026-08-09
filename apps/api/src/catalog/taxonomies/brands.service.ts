import { Injectable } from '@nestjs/common';
import type { UpsertBrandInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  create(input: UpsertBrandInput) {
    return this.prisma.brand.create({ data: input });
  }

  update(id: string, input: UpsertBrandInput) {
    return this.prisma.brand.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.brand.delete({ where: { id } });
  }
}
