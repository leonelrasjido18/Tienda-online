import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { productNameSuggestionSchema, type ProductNameSuggestion } from '@tienda/shared';
import sharp from 'sharp';

import type { Env } from '../../config/env.validation';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveUploadPath } from '../uploads/uploads.service';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
// La foto se achica antes de mandarla: alcanza para leer escudo, colores y sponsor,
// y baja bastante el costo en tokens.
const IMAGE_WIDTH = 768;
const REQUEST_TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = `Sos un experto en camisetas de fútbol. Mirás la foto de una camiseta y generás un NOMBRE de producto en español para una tienda argentina.

Respondé ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni fences de markdown, con exactamente estas claves:
- "team" (string): el club o selección de la camiseta (ej "Arsenal", "Boca Juniors", "Argentina"). Si no lo podés identificar con seguridad, poné "" (string vacío).
- "kind" (string): tipo de camiseta, uno de: "local" (titular), "visitante" (suplente/alternativa), "tercera", "cuarta", "arquero", "entrenamiento", "retro" (modelo antiguo/clásico), "edicion_especial", "otro".
- "season" (string|null): temporada o año SOLO si es claramente visible o deducible (ej "2024/25", "2023"), o null si no se puede saber. NO inventes la temporada.
- "confidence" (string): "alta" si estás seguro del equipo, "media" si es probable, "baja" si dudás.
- "name" (string): el nombre final, con formato "Camiseta <Equipo> <Tipo> [<Temporada>]". Ejemplos: "Camiseta Arsenal Local 2024/25", "Camiseta Boca Juniors Visitante", "Camiseta Argentina Retro 1986". Si no identificás el equipo, describí lo visible, ej "Camiseta de fútbol roja y blanca".

Reglas:
- Usá los colores dominantes, el escudo y el sponsor para identificar el equipo.
- NO inventes datos que no ves. Ante la duda, bajá la confianza y no arriesgues una temporada.
- "local" es el color clásico del club; "visitante" el alternativo. Si no estás seguro del tipo, usá "otro".
- El nombre SIEMPRE empieza con "Camiseta ".`;

const USER_PROMPT = 'Nombrá esta camiseta y devolvé el JSON siguiendo exactamente el formato indicado.';

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  error?: { message?: string };
}

@Injectable()
export class ProductNamerService {
  private readonly logger = new Logger(ProductNamerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  get enabled(): boolean {
    return this.config.get('ANTHROPIC_API_KEY') !== '';
  }

  /** Analiza una foto del producto y sugiere un nombre (no lo guarda). */
  async suggestName(productId: string, imageId?: string): Promise<ProductNameSuggestion> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }
    const image = imageId ? product.images.find((img) => img.id === imageId) : product.images[0];
    if (!image) {
      throw new BadRequestException('El producto no tiene fotos para analizar');
    }

    const jpeg = await sharp(resolveUploadPath(image.url))
      .resize({ width: IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return this.nameFromBuffer(jpeg);
  }

  /** Núcleo reutilizable: recibe una imagen y devuelve la sugerencia de nombre. */
  async nameFromBuffer(imageBuffer: Buffer): Promise<ProductNameSuggestion> {
    const apiKey = this.config.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'El análisis con IA no está configurado: falta ANTHROPIC_API_KEY en el servidor.',
      );
    }

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
        },
        body: JSON.stringify({
          model: this.config.get('ANTHROPIC_MODEL'),
          max_tokens: 512,
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
      this.logger.error('Falló la llamada al nombrador de IA', error as Error);
      throw new BadRequestException('No se pudo contactar al servicio de IA. Probá de nuevo en un momento.');
    } finally {
      clearTimeout(timeout);
    }

    return this.parseSuggestion(raw);
  }

  /** Extrae y valida el JSON, tolerando fences y normalizando el nombre. */
  private parseSuggestion(raw: string): ProductNameSuggestion {
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

    const result = productNameSuggestionSchema.safeParse(parsed);
    if (!result.success) {
      this.logger.warn(`Sugerencia fuera de esquema: ${result.error.message}`);
      throw new BadRequestException('La IA devolvió datos incompletos. Probá con otra foto más clara.');
    }

    // El nombre siempre debe arrancar con "Camiseta" y sin espacios de más.
    let name = result.data.name.replace(/\s+/g, ' ').trim();
    if (!/^camiseta\b/i.test(name)) {
      name = `Camiseta ${name}`;
    }
    return { ...result.data, name };
  }
}
