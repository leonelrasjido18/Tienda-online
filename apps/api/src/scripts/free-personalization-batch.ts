/**
 * Generador gratuito de personalización.
 *
 * No llama a servicios externos: usa Sharp para elegir contraste sobre la
 * espalda y fuentes ya cargadas en la base. Conserva configuraciones que ya
 * fueron ajustadas manualmente y solo automatiza las plantillas estándar.
 *
 * Uso: npx tsx src/scripts/free-personalization-batch.ts [--apply] [--limit N]
 */
import { join } from 'node:path';

import sharp from 'sharp';

import { PrismaService } from '../prisma/prisma.service';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const limitIndex = args.indexOf('--limit');
const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : undefined;
const uploadsRoot = join(process.cwd(), 'uploads');

// Márgenes conservadores: el preview calcula el tamaño de letra a partir de
// la altura de la caja. Estas proporciones evitan que un nombre de 5–7 letras
// invada las mangas y que un dorsal de dos cifras ocupe todo el torso.
const NAME_AREA = { x: 0.25, y: 0.245, width: 0.50, height: 0.080, rotation: 0, align: 'center' as const };
const NUMBER_AREA = { x: 0.29, y: 0.405, width: 0.42, height: 0.270, rotation: 0, align: 'center' as const };

function fontForProduct(productName: string, fonts: { id: string; name: string }[]) {
  const normalized = productName.toLowerCase();
  const wanted = /retro|19\d{2}|200[0-9]/.test(normalized)
    ? ['alfa slab retro', 'bungee retro', 'righteous retro', 'anton bloque']
    : /stencil|militar/.test(normalized)
      ? ['black ops stencil', 'stardos stencil', 'anton bloque']
      : ['anton bloque', 'archivo black bloque', 'fjalla bloque', 'squada bloque'];
  for (const name of wanted) {
    const match = fonts.find((font) => font.name.toLowerCase() === name);
    if (match) return match.id;
  }
  return fonts[0]?.id ?? null;
}

async function contrastForImage(url: string | null): Promise<{ fillColor: string; strokeColor: string | null; strokeWidthPx: number }> {
  if (!url?.startsWith('/uploads/')) return { fillColor: '#FFFFFF', strokeColor: null, strokeWidthPx: 0 };
  try {
    const raw = await sharp(join(uploadsRoot, url.slice('/uploads/'.length)))
      .resize(80, 100, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();
    // Muestra el torso central, donde se superpondrá el dorsal.
    const values: number[] = [];
    for (let y = 40; y < 78; y++) {
      for (let x = 28; x < 52; x++) {
        const offset = (y * 80 + x) * 3;
        values.push(
          0.2126 * (raw[offset] ?? 0) + 0.7152 * (raw[offset + 1] ?? 0) + 0.0722 * (raw[offset + 2] ?? 0),
        );
      }
    }
    values.sort((a, b) => a - b);
    const luminance = values[Math.floor(values.length / 2)] ?? 128;
    if (luminance > 165) return { fillColor: '#111111', strokeColor: null, strokeWidthPx: 0 };
    if (luminance > 105) return { fillColor: '#FFFFFF', strokeColor: '#111111', strokeWidthPx: 2 };
    return { fillColor: '#FFFFFF', strokeColor: null, strokeWidthPx: 0 };
  } catch {
    return { fillColor: '#FFFFFF', strokeColor: null, strokeWidthPx: 0 };
  }
}

function isCurated(template: { fontId: string | null; fillColor: string; strokeColor: string | null; strokeWidthPx: number; letterSpacingPx: number }) {
  return template.fontId !== null || template.fillColor !== '#FFFFFF' || template.strokeColor !== null || template.strokeWidthPx !== 0 || template.letterSpacingPx !== 0;
}

async function main() {
  // No inicializamos todo Nest: este proceso sólo necesita Prisma y Sharp.
  // Así puede ejecutarse en segundo plano sin los secretos del servidor web.
  const prisma = new PrismaService();
  await prisma.$connect();
  const fonts = await prisma.leagueFont.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });
  const products = await prisma.product.findMany({
    include: {
      images: { orderBy: { position: 'asc' }, select: { id: true, url: true, position: true } },
      customization: true,
    },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });

  let created = 0;
  let updated = 0;
  let preserved = 0;
  let skipped = 0;
  for (const product of products) {
    const back = product.images[1] ?? product.images[0];
    if (!back) {
      skipped++;
      continue;
    }
    const current = product.customization;
    if (current && isCurated(current)) {
      preserved++;
      continue;
    }
    const fontId = fontForProduct(product.name, fonts);
    const contrast = await contrastForImage(back.url);
    const data = {
      enableName: true,
      enableNumber: true,
      enablePatches: current?.enablePatches ?? false,
      maxNameLength: current?.maxNameLength ?? 12,
      minNumber: current?.minNumber ?? 1,
      maxNumber: current?.maxNumber ?? 99,
      nameExtraCents: current?.nameExtraCents ?? 0,
      numberExtraCents: current?.numberExtraCents ?? 0,
      fontId,
      fillColor: contrast.fillColor,
      strokeColor: contrast.strokeColor,
      strokeWidthPx: contrast.strokeWidthPx,
      letterSpacingPx: 0,
      customizationImageId: back.id,
      namePrintArea: NAME_AREA,
      numberPrintArea: NUMBER_AREA,
      patchPrintArea: current?.patchPrintArea ?? undefined,
    };
    console.log(`${apply ? 'APLICAR' : 'SIMULAR'} | ${product.name} | ${contrast.fillColor} | fuente:${fonts.find((f) => f.id === fontId)?.name ?? 'sin fuente'}`);
    if (!apply) continue;
    if (current) {
      await prisma.customizationTemplate.update({ where: { id: current.id }, data });
      updated++;
    } else {
      await prisma.customizationTemplate.create({ data: { ...data, productId: product.id } });
      created++;
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', products: products.length, created, updated, preserved, skipped }));
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
