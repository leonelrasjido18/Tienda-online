import { Body, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_KEYS,
  updateEmailTemplateSchema,
  type EmailTemplateKey,
  type UpdateEmailTemplateInput,
} from '@tienda/shared';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmailTemplatesService } from './email-templates.service';
import { EJEMPLOS_PREVISUALIZACION } from './email-preview-samples';

@Controller('admin/email-templates')
export class EmailTemplatesController {
  constructor(private readonly templates: EmailTemplatesService) {}

  /** Catálogo + contenido actual de cada correo. */
  @Get()
  async list() {
    const plantillas = await this.templates.list();
    return plantillas.map((p) => ({ ...p, ...EMAIL_TEMPLATE_CATALOG[p.key] }));
  }

  @Get(':key')
  async detail(@Param('key') key: string) {
    const clave = this.validarClave(key);
    return { ...(await this.templates.detail(clave)), ...EMAIL_TEMPLATE_CATALOG[clave] };
  }

  @Put(':key')
  async update(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateEmailTemplateSchema)) body: UpdateEmailTemplateInput,
  ) {
    return this.templates.update(this.validarClave(key), body);
  }

  /** Vuelve al texto original: borra la fila y se usa el del sistema. */
  @Post(':key/restore')
  async restore(@Param('key') key: string) {
    return this.templates.restore(this.validarClave(key));
  }

  /**
   * Renderiza con datos de ejemplo sin guardar nada, para ver cómo queda antes
   * de aplicar el cambio.
   */
  @Post(':key/preview')
  async preview(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateEmailTemplateSchema)) body: UpdateEmailTemplateInput,
  ) {
    const clave = this.validarClave(key);
    return this.templates.renderCon(clave, body, EJEMPLOS_PREVISUALIZACION[clave]);
  }

  private validarClave(key: string): EmailTemplateKey {
    if (!(EMAIL_TEMPLATE_KEYS as readonly string[]).includes(key)) {
      throw new NotFoundException('Esa plantilla de correo no existe');
    }
    return key as EmailTemplateKey;
  }
}
