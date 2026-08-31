import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  customizationAnalysisSchema,
  FONT_STYLE_LABELS,
  type CustomizationAnalysis,
  type CustomizationAnalysisResult,
} from '@tienda/shared';
import sharp from 'sharp';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUploadPath } from '../uploads/uploads.service';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// Se reduce la foto antes de mandarla: baja el costo en tokens sin perder lo que
// importa para leer color y estilo del estampado.
const ANALYSIS_IMAGE_WIDTH = 1024;
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `Sos un asistente experto en camisetas de fútbol. Analizás la foto de la ESPALDA de una camiseta (que suele mostrar un nombre de jugador y un dorsal de ejemplo) y describís el ESTILO del estampado para poder reproducirlo con otros nombres/números.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni fences de markdown, con exactamente estas claves:
- "hasName" (boolean): si hay un nombre de jugador visible (arriba del número).
- "hasNumber" (boolean): si hay un dorsal visible.
- "fillColor" (string): color de relleno del número/nombre en hex de 6 dígitos, ej "#C8102E". Muestreá el color dominante del estampado.
- "strokeColor" (string|null): color del contorno/borde en hex, o null si no tiene contorno.
- "strokeWidthPx" (integer 0-20): grosor aproximado del contorno en px (0 si no tiene).
- "letterSpacingPx" (integer -10 a 50): separación entre letras aproximada (0 si es normal).
- "fontStyle" (string): uno de "block" (bloque grueso moderno), "rounded" (redondeada), "condensed" (angosta/estirada), "serif" (con remates/clásica), "retro" (estilo años 70-90), "stencil" (tipo plantilla militar), "other".
- "namePrintArea": objeto {"x","y","width","height","rotation","align"} con la ubicación del NOMBRE. x,y,width,height son fracciones 0-1 relativas al tamaño de la foto (x,y = esquina superior izquierda de la caja). "rotation" en grados (-45 a 45), "align" uno de "left","center","right". Si no hay nombre, estimá dónde iría (arriba del número).
- "numberPrintArea": igual, para el DORSAL (el número grande y centrado).
- "notes" (string, máx 500): nota breve en español sobre lo que detectaste.

Reglas: los colores SIEMPRE en hex #RRGGBB. Las coordenadas SIEMPRE fracciones entre 0 y 1. No inventes contorno si no lo ves.`;

const USER_PROMPT =
  'Analizá esta camiseta y devolvé el JSON del estilo del estampado siguiendo exactamente el formato indicado.';

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  error?: { message?: string };
}

@Injectable()
export class AnalyzerService {
  private readonly logger = new Logger(AnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get enabled(): boolean {
    return this.config.get('ANTHROPIC_API_KEY') !== '';
  }

  /** Analiza una imagen del producto y mapea el estilo a una fuente de la librería. */
  async analyzeProductImage(productId: string, imageId: string): Promise<CustomizationAnalysisResult> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }
    const image = product.images.find((img) => img.id === imageId) ?? product.images[0];
    if (!image) {
      throw new BadRequestException('El producto no tiene fotos para analizar');
    }

    const jpeg = await sharp(resolveUploadPath(image.url))
      .resize({ width: ANALYSIS_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const analysis = await this.analyzeBuffer(jpeg);
    const suggestedFontId = await this.matchFont(analysis.fontStyle);

    return { ...analysis, suggestedFontId };
  }

  /**
   * Núcleo reutilizable: recibe una imagen (JPEG/PNG/WebP) y devuelve el estilo.
   * Está separado a propósito para que un futuro importador masivo pueda llamarlo
   * por lote sin depender de la base de datos.
   */
  async analyzeBuffer(imageBuffer: Buffer): Promise<CustomizationAnalysis> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'El análisis con IA no está configurado: falta ANTHROPIC_API_KEY en el servidor.',
      );
    }

    const workspaceId = this.config.get('ANTHROPIC_WORKSPACE_ID');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let raw: string;
    try {
      const res = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
          ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
        },
        body: JSON.stringify({
          model: this.config.get('ANTHROPIC_MODEL'),
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: { type: 'base64', media_type: 'image/jpeg', data: imageBuffer.toString('base64') },
                },
                { type: 'text', text: USER_PROMPT },
              ],
            },
          ],
        }),
      });

      const data = (await res.json()) as AnthropicResponse;
      if (!res.ok) {
        throw new BadRequestException(`El servicio de IA respondió con error: ${data.error?.message ?? res.status}`);
      }
      raw = data.content?.find((block) => block.type === 'text')?.text ?? '';
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.error('Falló la llamada al analizador de IA', error as Error);
      throw new BadRequestException('No se pudo contactar al servicio de IA. Probá de nuevo en un momento.');
    } finally {
      clearTimeout(timeout);
    }

    return this.parseAnalysis(raw);
  }

  /** Extrae y valida el JSON, tolerando que el modelo lo envuelva en fences. */
  private parseAnalysis(raw: string): CustomizationAnalysis {
    const jsonText = raw.replace(/```json\s*|\s*```/g, '').trim();
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new BadRequestException('La IA no devolvió un resultado que se pueda interpretar.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText.slice(start, end + 1));
    } catch {
      throw new BadRequestException('La IA devolvió un JSON inválido.');
    }

    const result = customizationAnalysisSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(`Análisis fuera de esquema: ${result.error.message}`);
      throw new BadRequestException('La IA devolvió datos incompletos. Probá con otra foto más clara.');
    }
    return result.data;
  }

  /** Mapea el estilo detectado a la fuente de la librería cuyo nombre lo mencione. */
  private async matchFont(fontStyle: CustomizationAnalysis['fontStyle']): Promise<string | null> {
    const fonts = await this.prisma.leagueFont.findMany({ select: { id: true, name: true } });
    if (fonts.length === 0) return null;

    const needles = [fontStyle, FONT_STYLE_LABELS[fontStyle].toLowerCase()];
    const match = fonts.find((font) => needles.some((needle) => font.name.toLowerCase().includes(needle)));
    return match?.id ?? null;
  }
}
