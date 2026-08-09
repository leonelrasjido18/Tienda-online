import { Injectable } from '@nestjs/common';
import type { UpsertTeamInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  list(leagueId?: string) {
    return this.prisma.team.findMany({
      where: leagueId ? { leagueId } : undefined,
      orderBy: { position: 'asc' },
    });
  }

  create(input: UpsertTeamInput) {
    return this.prisma.team.create({ data: input });
  }

  update(id: string, input: UpsertTeamInput) {
    return this.prisma.team.update({ where: { id }, data: input });
  }

  remove(id: string) {
    return this.prisma.team.delete({ where: { id } });
  }
}
