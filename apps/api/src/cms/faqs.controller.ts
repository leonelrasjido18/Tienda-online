import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class FaqsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Obtiene todas las preguntas frecuentes activas ordenadas por posición. */
  @Public()
  @Get('faqs')
  async getFaqs() {
    return this.prisma.fAQ.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
    });
  }

  /** [ADMIN] Lista todas las preguntas frecuentes (inactivas y activas). */
  @Get('admin/cms/faqs')
  async adminListFaqs() {
    return this.prisma.fAQ.findMany({
      orderBy: { position: 'asc' },
    });
  }

  /** [ADMIN] Obtiene una pregunta frecuente por ID. */
  @Get('admin/cms/faqs/:id')
  async adminGetFaq(@Param('id') id: string) {
    const faq = await this.prisma.fAQ.findUnique({
      where: { id },
    });
    if (!faq) {
      throw new NotFoundException('Pregunta frecuente no encontrada');
    }
    return faq;
  }

  /** [ADMIN] Crea una nueva pregunta frecuente. */
  @Post('admin/cms/faqs')
  @HttpCode(HttpStatus.CREATED)
  async adminCreateFaq(
    @Body('question') question: string,
    @Body('answerHtml') answerHtml: string,
    @Body('answerMd') answerMd: string,
    @Body('category') category: string,
    @Body('isActive') isActive?: boolean,
  ) {
    // Buscar la posición más alta para colocarla al final por defecto
    const lastFaq = await this.prisma.fAQ.findFirst({
      orderBy: { position: 'desc' },
    });
    const position = lastFaq ? lastFaq.position + 1 : 0;

    return this.prisma.fAQ.create({
      data: {
        question,
        answerHtml,
        answerMd,
        category: category.toLowerCase().trim(),
        position,
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  /** [ADMIN] Actualiza una pregunta frecuente. */
  @Put('admin/cms/faqs/:id')
  async adminUpdateFaq(
    @Param('id') id: string,
    @Body('question') question: string,
    @Body('answerHtml') answerHtml: string,
    @Body('answerMd') answerMd: string,
    @Body('category') category: string,
    @Body('isActive') isActive?: boolean,
  ) {
    return this.prisma.fAQ.update({
      where: { id },
      data: {
        question,
        answerHtml,
        answerMd,
        category: category.toLowerCase().trim(),
        isActive: isActive !== undefined ? isActive : true,
      },
    });
  }

  /** [ADMIN] Elimina una pregunta frecuente. */
  @Delete('admin/cms/faqs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async adminDeleteFaq(@Param('id') id: string) {
    await this.prisma.fAQ.delete({
      where: { id },
    });
  }

  /** [ADMIN] Reordena una lista de preguntas frecuentes por sus IDs. */
  @Patch('admin/cms/faqs/reorder')
  @HttpCode(HttpStatus.OK)
  async adminReorderFaqs(@Body('ids') ids: string[]) {
    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.fAQ.update({
          where: { id },
          data: { position: index },
        }),
      ),
    );
    return { success: true };
  }
}
