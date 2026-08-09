import { Injectable } from '@nestjs/common';
import type { UpsertLeagueInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.league.findMany({ orderBy: { position: 'asc' } });
  }

  create(input: UpsertLeagueInput) {
    return this.prisma.league.create({ data: input });
  }

  update(id: string, input: UpsertLeagueInput) {
    return this.prisma.league.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.league.delete({ where: { id } });
  }
}
