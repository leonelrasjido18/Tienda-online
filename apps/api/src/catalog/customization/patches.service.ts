import { Injectable } from '@nestjs/common';
import type { PatchDto, UpsertPatchInput } from '@tienda/shared';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

const PATCH_INCLUDE = { leagues: true } satisfies Prisma.PatchInclude;
type PatchWithLeagues = Prisma.PatchGetPayload<{ include: typeof PATCH_INCLUDE }>;

@Injectable()
export class PatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PatchDto[]> {
    const patches = await this.prisma.patch.findMany({ include: PATCH_INCLUDE, orderBy: { name: 'asc' } });
    return patches.map((p) => this.toDto(p));
  }

  async create(input: UpsertPatchInput): Promise<PatchDto> {
    const patch = await this.prisma.patch.create({
      data: {
        name: input.name,
        imageUrl: input.imageUrl,
        priceCents: input.priceCents,
        leagues: { create: input.leagueIds.map((leagueId) => ({ leagueId })) },
      },
      include: PATCH_INCLUDE,
    });
    return this.toDto(patch);
  }

  async update(id: string, input: UpsertPatchInput): Promise<PatchDto> {
    await this.prisma.patchLeague.deleteMany({ where: { patchId: id } });
    const patch = await this.prisma.patch.update({
      where: { id },
      data: {
        name: input.name,
        imageUrl: input.imageUrl,
        priceCents: input.priceCents,
        leagues: { create: input.leagueIds.map((leagueId) => ({ leagueId })) },
      },
      include: PATCH_INCLUDE,
    });
    return this.toDto(patch);
  }

  remove(id: string) {
    return this.prisma.patch.delete({ where: { id } });
  }

  private toDto(patch: PatchWithLeagues): PatchDto {
    return {
      id: patch.id,
      name: patch.name,
      imageUrl: patch.imageUrl,
      priceCents: patch.priceCents,
      leagueIds: patch.leagues.map((l) => l.leagueId),
    };
  }
}
