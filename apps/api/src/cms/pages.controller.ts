import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class PagesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Obtiene una página estática activa para el storefront. */
  @Public()
  @Get('pages/:slug')
  async getPage(@Param('slug') slug: string) {
    const page = await this.prisma.staticPage.findFirst({
      where: { slug, isActive: true },
    });
    if (!page) {
      throw new NotFoundException('La página solicitada no existe');
    }
    return page;
  }

  /** [ADMIN] Lista todas las páginas estáticas. */
  @Get('admin/cms/pages')
  async adminListPages() {
    return this.prisma.staticPage.findMany({
      orderBy: { title: 'asc' },
    });
  }

  /** [ADMIN] Obtiene los detalles de una página por ID. */
  @Get('admin/cms/pages/:id')
  async adminGetPage(@Param('id') id: string) {
    const page = await this.prisma.staticPage.findUnique({
      where: { id },
    });
    if (!page) {
      throw new NotFoundException('Página no encontrada');
    }
    return page;
  }

  /** [ADMIN] Crea una nueva página estática. */
  @Post('admin/cms/pages')
  @HttpCode(HttpStatus.CREATED)
  async adminCreatePage(
    @Body('title') title: string,
    @Body('slug') slug: string,
    @Body('contentHtml') contentHtml: string,
    @Body('contentMd') contentMd?: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.prisma.staticPage.create({
      data: {
        title,
        slug: slug.toLowerCase().trim(),
        contentHtml,
        contentMd: contentMd || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  /** [ADMIN] Actualiza una página estática existente. */
  @Put('admin/cms/pages/:id')
  async adminUpdatePage(
    @Param('id') id: string,
    @Body('title') title: string,
    @Body('slug') slug: string,
    @Body('contentHtml') contentHtml: string,
    @Body('contentMd') contentMd?: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.prisma.staticPage.update({
      where: { id },
      data: {
        title,
        slug: slug.toLowerCase().trim(),
        contentHtml,
        contentMd: contentMd || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  /** [ADMIN] Elimina una página estática. */
  @Delete('admin/cms/pages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDeletePage(@Param('id') id: string) {
    await this.prisma.staticPage.delete({
      where: { id },
    });
  }
}
