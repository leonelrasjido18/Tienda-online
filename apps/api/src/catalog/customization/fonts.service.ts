import { Injectable } from '@nestjs/common';
import type { UpsertLeagueFontInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FontsService {
  constructor(private readonly prisma: PrismaService) {}

  list(leagueId?: string) {
    return this.prisma.leagueFont.findMany({
      where: leagueId ? { leagueId } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  create(input: UpsertLeagueFontInput) {
    return this.prisma.leagueFont.create({ data: input });
  }

  update(id: string, input: UpsertLeagueFontInput) {
    return this.prisma.leagueFont.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.leagueFont.delete({ where: { id } });
  }
}
