import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { computeFontSizeForBox, resolvePrintArea, type PrintArea } from '@tienda/shared';
import satori from 'satori';
import sharp from 'sharp';

import { PrismaService } from '../../prisma/prisma.service';
import { resolveUploadPath } from '../uploads/uploads.service';
import { TemplatesService } from './templates.service';

const CANVAS_WIDTH = 1200;
const STROKE_OFFSETS = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
] as const;

export interface RenderCustomizationInput {
  playerName?: string;
  playerNumber?: number;
  patchIds: string[];
}

// Satori no entiende JSX real: son objetos planos con la misma forma que un
// elemento de React (type + props.children), suficiente para su renderer.
interface SatoriNode {
  type: string;
  props: Record<string, unknown> & { children?: SatoriNode | SatoriNode[] | string };
}

// El estilo del estampado: el tipo de letra sale de la fuente, pero color, contorno
// e interletrado son propios del producto (los completa el analizador de IA).
interface TextStyle {
  fontName: string;
  fillColor: string;
  strokeColor: string | null;
  strokeWidthPx: number;
  letterSpacingPx: number;
}

@Injectable()
export class RenderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  async renderProductCustomization(productId: string, input: RenderCustomizationInput): Promise<Buffer> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: { orderBy: { position: 'asc' } } },
    });
    if (!product) {
      throw new NotFoundException('El producto no existe');
    }

    const customization = await this.templates.get(productId);
    if (!customization) {
      throw new BadRequestException('El producto no tiene personalización configurada');
    }
    if (!customization.font) {
      throw new BadRequestException('El producto no tiene una tipografía asignada para personalizar');
    }

    const coverImage =
      product.images.find((image) => image.id === customization.customizationImageId) ?? product.images[0];
    if (!coverImage) {
      throw new BadRequestException('El producto no tiene fotos cargadas');
    }

    const backgroundPath = resolveUploadPath(coverImage.url);
    const dimensions = await sharp(backgroundPath).metadata();
    const sourceWidth = dimensions.width ?? CANVAS_WIDTH;
    const sourceHeight = dimensions.height ?? CANVAS_WIDTH;
    const canvasHeight = Math.round((sourceHeight / sourceWidth) * CANVAS_WIDTH);

    const [backgroundDataUri, fontBuffer] = await Promise.all([
      this.toDataUri(backgroundPath),
      readFile(resolveUploadPath(customization.font.fontFileUrl)),
    ]);

    const font = customization.font;
    // El color/contorno viene de la plantilla del producto, no de la fuente.
    const style: TextStyle = {
      fontName: font.name,
      fillColor: customization.fillColor,
      strokeColor: customization.strokeColor,
      strokeWidthPx: customization.strokeWidthPx,
      letterSpacingPx: customization.letterSpacingPx,
    };
    const children: SatoriNode[] = [
      {
        type: 'img',
        props: {
          src: backgroundDataUri,
          width: CANVAS_WIDTH,
          height: canvasHeight,
          style: { position: 'absolute', left: 0, top: 0 },
        },
      },
    ];

    if (customization.enableName && input.playerName) {
      children.push(
        ...this.textLayers(input.playerName.toUpperCase(), customization.namePrintArea, CANVAS_WIDTH, canvasHeight, style),
      );
    }
    if (customization.enableNumber && input.playerNumber !== undefined) {
      children.push(
        ...this.textLayers(String(input.playerNumber), customization.numberPrintArea, CANVAS_WIDTH, canvasHeight, style),
      );
    }

    if (customization.enablePatches && customization.patchPrintArea && input.patchIds.length > 0) {
      const selectedPatches = customization.patches.filter((p) => input.patchIds.includes(p.id));
      const box = resolvePrintArea(customization.patchPrintArea, CANVAS_WIDTH, canvasHeight);
      const slotWidth = box.width / Math.max(1, selectedPatches.length);

      for (const [index, patch] of selectedPatches.entries()) {
        const patchDataUri = await this.toDataUri(resolveUploadPath(patch.imageUrl));
        children.push({
          type: 'img',
          props: {
            src: patchDataUri,
            width: slotWidth,
            height: box.height,
            style: { position: 'absolute', left: box.left + index * slotWidth, top: box.top },
          },
        });
      }
    }

    const root: SatoriNode = {
      type: 'div',
      props: { style: { width: CANVAS_WIDTH, height: canvasHeight, display: 'flex' }, children },
    };

    const svg = await satori(
      root as unknown as Parameters<typeof satori>[0],
      {
        width: CANVAS_WIDTH,
        height: canvasHeight,
        fonts: [{ name: font.name, data: fontBuffer, weight: 700, style: 'normal' }],
      },
    );

    return sharp(Buffer.from(svg)).png().toBuffer();
  }

  private textLayers(
    text: string,
    area: PrintArea,
    canvasWidth: number,
    canvasHeight: number,
    style: TextStyle,
  ): SatoriNode[] {
    const box = resolvePrintArea(area, canvasWidth, canvasHeight);
    const fontSize = computeFontSizeForBox(text, box);
    const justifyContent = box.align === 'left' ? 'flex-start' : box.align === 'right' ? 'flex-end' : 'center';

    const baseStyle = {
      position: 'absolute' as const,
      width: box.width,
      height: box.height,
      display: 'flex' as const,
      alignItems: 'center' as const,
      justifyContent,
      fontSize,
      fontFamily: style.fontName,
      // Satori no tolera bien valores `undefined` en el estilo (intenta parsearlos
      // igual); se omiten las claves en vez de dejarlas en undefined.
      ...(style.letterSpacingPx ? { letterSpacing: `${style.letterSpacingPx}px` } : {}),
      ...(box.rotation ? { transform: `rotate(${box.rotation}deg)` } : {}),
    };

    const layers: SatoriNode[] = [];

    // Contorno "falso": el mismo texto duplicado en el color de borde, desplazado
    // en las cuatro diagonales, detrás del texto de relleno. Satori no soporta
    // text-stroke real, pero sí posición + color, que alcanza para este efecto.
    if (style.strokeColor && style.strokeWidthPx > 0) {
      for (const [dx, dy] of STROKE_OFFSETS) {
        layers.push({
          type: 'div',
          props: {
            style: {
              ...baseStyle,
              left: box.left + dx * style.strokeWidthPx,
              top: box.top + dy * style.strokeWidthPx,
              color: style.strokeColor,
            },
            children: text,
          },
        });
      }
    }

    layers.push({
      type: 'div',
      props: {
        style: { ...baseStyle, left: box.left, top: box.top, color: style.fillColor },
        children: text,
      },
    });

    return layers;
  }

  // Satori no decodifica WebP (que es el formato en el que UploadsService guarda
  // todo lo demás) — se reconvierte a PNG en memoria sólo para este uso puntual.
  private async toDataUri(absolutePath: string): Promise<string> {
    const ext = extname(absolutePath).toLowerCase();
    if (ext === '.webp') {
      const png = await sharp(absolutePath).png().toBuffer();
      return `data:image/png;base64,${png.toString('base64')}`;
    }

    const buffer = await readFile(absolutePath);
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }
}
