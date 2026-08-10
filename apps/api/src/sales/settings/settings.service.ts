import { Injectable } from '@nestjs/common';
import type { UpdateStoreSettingsInput } from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const existing = await this.prisma.storeSettings.findUnique({ where: { id: 1 } });
    if (existing) return existing;
    return this.prisma.storeSettings.create({ data: { id: 1 } });
  }

  async update(input: UpdateStoreSettingsInput) {
    await this.get();
    return this.prisma.storeSettings.update({ where: { id: 1 }, data: input });
  }
}
