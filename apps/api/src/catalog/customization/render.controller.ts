import { BadRequestException, Body, Controller, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { buildCustomizationInputSchema, customizationInputSchema } from '@tienda/shared';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { Public } from '../../auth/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { RenderService } from './render.service';
import { TemplatesService } from './templates.service';

@Public()
@Controller('catalog/products/:slug/customize')
export class RenderController {
  constructor(
    private readonly renderService: RenderService,
    private readonly templates: TemplatesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('render')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async render(@Param('slug') slug: string, @Body() body: unknown, @Res() res: Response) {
    const product = await this.prisma.product.findFirst({ where: { slug, status: 'ACTIVE' } });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const customization = await this.templates.get(product.id);
    if (!customization) {
      throw new BadRequestException('Este producto no admite personalización');
    }

    const loose = customizationInputSchema.parse(body);
    const strict = buildCustomizationInputSchema({
      maxNameLength: customization.maxNameLength,
      minNumber: customization.minNumber,
      maxNumber: customization.maxNumber,
    }).parse(loose);

    const buffer = await this.renderService.renderProductCustomization(product.id, {
      playerName: strict.playerName,
      playerNumber: strict.playerNumber,
      patchIds: strict.patchIds,
    });

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  }
}
