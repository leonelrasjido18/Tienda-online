import { Injectable } from '@nestjs/common';
import type { UpsertSeasonInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SeasonsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.season.findMany({ orderBy: { position: 'asc' } });
  }

  create(input: UpsertSeasonInput) {
    return this.prisma.season.create({ data: input });
  }

  update(id: string, input: UpsertSeasonInput) {
    return this.prisma.season.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.season.delete({ where: { id } });
  }
}
