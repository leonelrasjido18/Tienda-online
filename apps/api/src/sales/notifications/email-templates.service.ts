import { Injectable } from '@nestjs/common';
import {
  EMAIL_TEMPLATE_CATALOG,
  EMAIL_TEMPLATE_KEYS,
  renderEmailTemplate,
  type EmailTemplateDto,
  type EmailTemplateKey,
  type UpdateEmailTemplateInput,
} from '@tienda/shared';

import { PrismaService } from '../../prisma/prisma.service';
import { EMAIL_DEFAULTS } from './email-defaults';

/** Escapa lo que viene de datos del cliente antes de meterlo en el HTML. */
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]!,
  );
}

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas las plantillas, con o sin edición, para la pantalla del panel. */
  async list(): Promise<EmailTemplateDto[]> {
    const guardadas = await this.prisma.emailTemplate.findMany();
    const porClave = new Map(guardadas.map((t) => [t.key, t]));

    return EMAIL_TEMPLATE_KEYS.map((key) => {
      const guardada = porClave.get(key);
      return {
        key,
        subject: guardada?.subject ?? EMAIL_DEFAULTS[key].subject,
        bodyHtml: guardada?.bodyHtml ?? EMAIL_DEFAULTS[key].bodyHtml,
        personalizada: !!guardada,
        updatedAt: guardada?.updatedAt.toISOString() ?? null,
      };
    });
  }

  async detail(key: EmailTemplateKey): Promise<EmailTemplateDto> {
    const todas = await this.list();
    return todas.find((t) => t.key === key)!;
  }

  async update(key: EmailTemplateKey, input: UpdateEmailTemplateInput): Promise<EmailTemplateDto> {
    await this.prisma.emailTemplate.upsert({
      where: { key },
      create: { key, subject: input.subject, bodyHtml: input.bodyHtml },
      update: { subject: input.subject, bodyHtml: input.bodyHtml },
    });
    return this.detail(key);
  }

  /** Volver al original es simplemente borrar la fila. */
  async restore(key: EmailTemplateKey): Promise<EmailTemplateDto> {
    await this.prisma.emailTemplate.deleteMany({ where: { key } });
    return this.detail(key);
  }

  /**
   * Arma el correo final. `valores` trae texto plano que se escapa, salvo las
   * variables declaradas `isHtml` en el catálogo, que son bloques que arma el
   * sistema (la tabla de productos) y ya vienen listos.
   */
  async render(key: EmailTemplateKey, valores: Record<string, string>): Promise<{ subject: string; html: string }> {
    const plantilla = await this.detail(key);
    return this.renderCon(key, plantilla, valores);
  }

  /** Igual que `render` pero sobre una plantilla dada, para previsualizar sin guardar. */
  renderCon(
    key: EmailTemplateKey,
    plantilla: { subject: string; bodyHtml: string },
    valores: Record<string, string>,
  ): { subject: string; html: string } {
    const sinEscapar = new Set(
      EMAIL_TEMPLATE_CATALOG[key].variables.filter((v) => v.isHtml).map((v) => v.name),
    );

    const preparados: Record<string, string> = {};
    for (const [nombre, valor] of Object.entries(valores)) {
      preparados[nombre] = sinEscapar.has(nombre) ? valor : escapeHtml(valor);
    }

    return {
      // El asunto va siempre en texto plano: escapar ahí metería &amp; a la vista.
      subject: renderEmailTemplate(plantilla.subject, valores),
      html: renderEmailTemplate(plantilla.bodyHtml, preparados),
    };
  }
}
