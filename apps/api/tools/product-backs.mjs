/**
 * Empareja los frentes ya cargados con su carpeta original y adjunta la espalda.
 *
 * Modos:
 *   export  Lee productos + primera imagen desde Prisma y genera huellas visuales.
 *   match   Compara esas huellas con los archivos 003 del catálogo local.
 *   prepare Convierte el staging a los WebP finales y actualiza el manifiesto.
 *   apply   Valida un manifiesto, procesa las espaldas y las adjunta (dry-run por defecto).
 *
 * La decisión nunca depende del nombre actual del producto.
 */
/* global console */
import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import process from 'node:process';

import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const AUTO_ALT_PREFIX = '[AUTO_BACK]';
const FINGERPRINT_SIZE = 16;
const MAX_WIDTH = 1600;

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Falta el valor de --${name}`);
  return value;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

async function fingerprint(input) {
  const pixels = await sharp(input, { failOn: 'warning' })
    .rotate()
    .resize(FINGERPRINT_SIZE, FINGERPRINT_SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const gray = new Uint8Array(FINGERPRINT_SIZE * FINGERPRINT_SIZE);
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 3;
    gray[i] = Math.round(pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114);
  }
  const bits = [];
  for (let y = 0; y < FINGERPRINT_SIZE; y++) {
    for (let x = 0; x < FINGERPRINT_SIZE - 1; x++) {
      bits.push(gray[y * FINGERPRINT_SIZE + x] > gray[y * FINGERPRINT_SIZE + x + 1]);
    }
  }
  for (let y = 0; y < FINGERPRINT_SIZE - 1; y++) {
    for (let x = 0; x < FINGERPRINT_SIZE; x++) {
      bits.push(gray[y * FINGERPRINT_SIZE + x] > gray[(y + 1) * FINGERPRINT_SIZE + x]);
    }
  }
  const packed = Buffer.alloc(Math.ceil(bits.length / 8));
  bits.forEach((bit, index) => {
    if (bit) packed[Math.floor(index / 8)] |= 1 << (index % 8);
  });
  return { hash: packed.toString('base64'), rgb: pixels.toString('base64') };
}

async function sha256File(input) {
  return createHash('sha256').update(await readFile(input)).digest('hex');
}

async function uploadConversionSha256(input) {
  const converted = await sharp(input, { limitInputPixels: 40_000_000, failOn: 'warning' })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return createHash('sha256').update(converted).digest('hex');
}

const BIT_COUNTS = Uint8Array.from({ length: 256 }, (_, value) => {
  let count = 0;
  for (let n = value; n; n >>= 1) count += n & 1;
  return count;
});

function decodeFingerprint(value) {
  return { hash: Buffer.from(value.hash, 'base64'), rgb: Buffer.from(value.rgb, 'base64') };
}

function hashDistance(leftHash, rightHash) {
  let hamming = 0;
  for (let i = 0; i < leftHash.length; i++) hamming += BIT_COUNTS[leftHash[i] ^ rightHash[i]];
  return hamming;
}

function rgbDistance(leftRgb, rightRgb) {
  let absolute = 0;
  for (let i = 0; i < leftRgb.length; i++) absolute += Math.abs(leftRgb[i] - rightRgb[i]);
  return absolute / leftRgb.length;
}

async function listImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function firstImageSelection(directory) {
  const images = await listImages(directory);
  const preferred = images.filter((name) => basename(name, extname(name)) === '003' || name.startsWith('003'));
  if (preferred.length) return preferred;
  return images.length > 3 ? [images[3]] : [];
}

async function exportProducts() {
  const outputPath = resolve(argument('out', 'product-fronts.json'));
  const prisma = new PrismaClient();
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        images: {
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, url: true, alt: true, position: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const rows = [];
    for (const [index, product] of products.entries()) {
      const front = product.images[0];
      if (!front?.url?.startsWith('/uploads/')) {
        rows.push({
          productId: product.id,
          productName: product.name,
          createdAt: product.createdAt.toISOString(),
          imageCount: product.images.length,
          status: 'SIN_FRENTE_LOCAL',
        });
        continue;
      }
      const filePath = resolve(process.cwd(), 'uploads', front.url.slice('/uploads/'.length));
      try {
        rows.push({
          productId: product.id,
          productName: product.name,
          createdAt: product.createdAt.toISOString(),
          imageCount: product.images.length,
          frontImageId: front.id,
          frontUrl: front.url,
          frontSha256: await sha256File(filePath),
          fingerprint: await fingerprint(filePath),
          status: 'OK',
        });
      } catch (error) {
        rows.push({
          productId: product.id,
          productName: product.name,
          createdAt: product.createdAt.toISOString(),
          imageCount: product.images.length,
          frontImageId: front.id,
          frontUrl: front.url,
          status: 'ERROR_IMAGEN',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      if ((index + 1) % 100 === 0) process.stderr.write(`Exportadas ${index + 1}/${products.length}\n`);
    }
    await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
    console.log(JSON.stringify({ outputPath, products: products.length, withFingerprint: rows.filter((r) => r.fingerprint).length }));
  } finally {
    await prisma.$disconnect();
  }
}

async function buildCandidates(catalogRoot, backsRoot) {
  const backFolders = (await readdir(backsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const candidates = [];
  const unavailableCandidates = [];
  const noBack = [];
  for (const [index, folder] of backFolders.entries()) {
    const backDirectory = join(backsRoot, folder);
    const backImages = await listImages(backDirectory);
    const frontDirectory = join(catalogRoot, folder);
    let fronts = [];
    try {
      fronts = await firstImageSelection(frontDirectory);
    } catch {
      noBack.push({ folder, count: 1, reason: 'SIN_CARPETA_ORIGINAL' });
      continue;
    }
    for (const frontName of fronts) {
      const frontPath = join(frontDirectory, frontName);
      const candidate = {
        folder,
        frontName,
        frontPath,
        processedFrontSha256: await uploadConversionSha256(frontPath),
        fingerprint: decodeFingerprint(await fingerprint(frontPath)),
      };
      if (backImages.length === 1) {
        candidates.push({
          ...candidate,
          backName: backImages[0],
          backPath: join(backDirectory, backImages[0]),
        });
      } else {
        unavailableCandidates.push(candidate);
      }
    }
    if (backImages.length !== 1) noBack.push({ folder, count: backImages.length });
    if ((index + 1) % 100 === 0) process.stderr.write(`Indexadas ${index + 1}/${backFolders.length} carpetas\n`);
  }
  return { candidates, unavailableCandidates, noBack };
}

function confidence(best, second) {
  const margin = second ? second.score - best.score : 999;
  // El WebP de la tienda fue redimensionado y recomprimido. La combinación de
  // estructura (Hamming) y color (MAE) tolera esa conversión, pero exige una
  // diferencia clara respecto del segundo candidato.
  if (best.mae <= 8 && best.score <= 115 && margin >= 8) return 'ALTA';
  if (best.mae <= 10 && best.score <= 140 && margin >= 5) return 'MEDIA';
  return 'BAJA';
}

async function matchProducts() {
  const productsPath = resolve(argument('products'));
  const catalogRoot = resolve(argument('catalog'));
  const backsRoot = resolve(argument('backs'));
  const outputPath = resolve(argument('out', 'product-backs-manifest.json'));
  const csvPath = resolve(argument('csv', outputPath.replace(/\.json$/i, '.csv')));
  const stageRoot = resolve(argument('stage', join(resolve(outputPath, '..'), 'espaldas-para-subir')));
  const productExport = JSON.parse(await readFile(productsPath, 'utf8'));
  const { candidates, unavailableCandidates, noBack } = await buildCandidates(catalogRoot, backsRoot);
  await mkdir(stageRoot, { recursive: true });

  const proposed = [];
  for (const [index, product] of productExport.rows.entries()) {
    if (!product.fingerprint) {
      proposed.push({ ...product, matchStatus: product.status ?? 'SIN_HUELLA' });
      continue;
    }
    if (product.imageCount !== 1) {
      proposed.push({ ...product, matchStatus: 'OMITIDO_YA_TIENE_VARIAS_IMAGENES' });
      continue;
    }
    const productFingerprint = decodeFingerprint(product.fingerprint);
    const unavailableExact = unavailableCandidates.filter(
      (candidate) => candidate.processedFrontSha256 === product.frontSha256,
    );
    if (unavailableExact.length) {
      proposed.push({
        productId: product.productId,
        productName: product.productName,
        createdAt: product.createdAt,
        expectedImageCount: product.imageCount,
        expectedFrontImageId: product.frontImageId,
        expectedFrontUrl: product.frontUrl,
        matchStatus: 'SIN_ESPALDA',
        confidence: 'EXACTA',
        folder: unavailableExact.map((candidate) => candidate.folder).join(' | '),
        frontName: unavailableExact.map((candidate) => candidate.frontName).join(' | '),
      });
      continue;
    }
    const exact = candidates.filter((candidate) => candidate.processedFrontSha256 === product.frontSha256);
    const byHash = candidates
      .map((candidate) => ({
        candidate,
        hamming: hashDistance(productFingerprint.hash, candidate.fingerprint.hash),
      }))
      .sort((a, b) => a.hamming - b.hamming);
    // El color solo se calcula para los mejores hashes. Reduce el cruce de cientos
    // de millones de comparaciones sin alterar la elección de una copia del frente.
    const ranked = byHash.slice(0, 24)
      .map((row) => {
        const mae = rgbDistance(productFingerprint.rgb, row.candidate.fingerprint.rgb);
        return { ...row, mae, score: row.hamming + mae * 4 };
      })
      .sort((a, b) => a.score - b.score);
    const best = ranked[0];
    const exactFolders = new Set(exact.map((candidate) => candidate.folder));
    const exactCandidate = exactFolders.size === 1 ? exact[0] : null;
    const selected = exactCandidate
      ? ranked.find((row) => row.candidate.folder === exactCandidate.folder) ?? best
      : best;
    const selectedSecond = ranked.find((row) => row.candidate.folder !== selected.candidate.folder);
    const level = exactCandidate ? 'EXACTA' : confidence(selected, selectedSecond);
    const matchStatus = exactFolders.size > 1
      ? 'REVISAR_DUPLICADO_EXACTO'
      : level === 'EXACTA' || level === 'ALTA'
        ? 'LISTO'
        : 'REVISAR';
    proposed.push({
      productId: product.productId,
      productName: product.productName,
      createdAt: product.createdAt,
      expectedImageCount: product.imageCount,
      expectedFrontImageId: product.frontImageId,
      expectedFrontUrl: product.frontUrl,
      matchStatus,
      confidence: level,
      exactCandidateCount: exact.length,
      exactFolderCount: exactFolders.size,
      folder: selected.candidate.folder,
      frontName: selected.candidate.frontName,
      backName: selected.candidate.backName,
      hamming: selected.hamming,
      mae: Number(selected.mae.toFixed(4)),
      score: Number(selected.score.toFixed(4)),
      secondFolder: selectedSecond?.candidate.folder ?? null,
      secondHamming: selectedSecond?.hamming ?? null,
      secondMae: selectedSecond ? Number(selectedSecond.mae.toFixed(4)) : null,
      secondScore: selectedSecond ? Number(selectedSecond.score.toFixed(4)) : null,
      backPath: selected.candidate.backPath,
    });
    if ((index + 1) % 100 === 0) process.stderr.write(`Comparados ${index + 1}/${productExport.rows.length} productos\n`);
  }

  // Una carpeta original no puede asignarse automáticamente a dos productos.
  const byFolder = new Map();
  for (const row of proposed.filter((row) => row.matchStatus === 'LISTO')) {
    const siblings = byFolder.get(row.folder) ?? [];
    siblings.push(row);
    byFolder.set(row.folder, siblings);
  }
  for (const siblings of byFolder.values()) {
    if (siblings.length > 1) siblings.forEach((row) => { row.matchStatus = 'REVISAR_DUPLICADO'; });
  }

  let staged = 0;
  for (const row of proposed.filter((item) => item.matchStatus === 'LISTO')) {
    const extension = extname(row.backName).toLowerCase();
    const stageName = `${row.productId}${extension}`;
    await copyFile(row.backPath, join(stageRoot, stageName));
    row.stageName = stageName;
    row.backSha256 = createHash('sha256').update(await readFile(row.backPath)).digest('hex');
    delete row.backPath;
    staged++;
  }

  const summary = {
    products: productExport.rows.length,
    candidates: candidates.length,
    ready: proposed.filter((row) => row.matchStatus === 'LISTO').length,
    review: proposed.filter((row) => row.matchStatus?.startsWith('REVISAR')).length,
    skipped: proposed.filter((row) => !['LISTO'].includes(row.matchStatus) && !row.matchStatus?.startsWith('REVISAR')).length,
    noBackFolders: noBack.length,
    staged,
  };
  await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, noBack, rows: proposed }, null, 2));
  const escapeCsv = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const headers = ['productId', 'productName', 'matchStatus', 'confidence', 'folder', 'frontName', 'backName', 'hamming', 'mae', 'score', 'secondFolder', 'secondHamming', 'secondMae', 'secondScore'];
  const csv = [headers.join(','), ...proposed.map((row) => headers.map((key) => escapeCsv(row[key])).join(','))].join('\n');
  await writeFile(csvPath, `\uFEFF${csv}\n`);
  console.log(JSON.stringify({ outputPath, csvPath, stageRoot, summary }, null, 2));
}

async function processBackImage(inputPath, outputPath) {
  await sharp(inputPath, { limitInputPixels: 40_000_000, failOn: 'warning' })
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(outputPath);
}

async function prepareStage() {
  const manifestPath = resolve(argument('manifest'));
  const inputStage = resolve(argument('input-stage'));
  const outputStage = resolve(argument('stage'));
  const outputPath = resolve(argument('out', 'product-backs-upload-manifest.json'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const ready = manifest.rows.filter((row) => row.matchStatus === 'LISTO');
  await mkdir(outputStage, { recursive: true });
  for (const [index, row] of ready.entries()) {
    const inputPath = join(inputStage, row.stageName);
    const currentSha = await sha256File(inputPath);
    if (currentSha !== row.backSha256) throw new Error(`Hash de staging inválido: ${row.productId}`);
    const stageName = `${row.productId}.webp`;
    const outputFile = join(outputStage, stageName);
    let reusable = false;
    try {
      await sharp(outputFile, { failOn: 'error' }).metadata();
      reusable = true;
    } catch {
      await rm(outputFile, { force: true });
    }
    if (!reusable) await processBackImage(inputPath, outputFile);
    row.sourceBackSha256 = row.backSha256;
    row.backSha256 = await sha256File(outputFile);
    row.stageName = stageName;
    row.stagedProcessed = true;
    if ((index + 1) % 50 === 0) process.stderr.write(`Preparadas ${index + 1}/${ready.length}\n`);
  }
  manifest.preparedAt = new Date().toISOString();
  manifest.preparedStageFiles = ready.length;
  await writeFile(outputPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({ outputPath, outputStage, prepared: ready.length }, null, 2));
}

async function applyManifest() {
  const manifestPath = resolve(argument('manifest'));
  const stageRoot = resolve(argument('stage'));
  const shouldApply = flag('apply');
  const outputPath = resolve(argument('out', shouldApply ? 'backfill-applied.json' : 'backfill-dry-run.json'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const ready = manifest.rows.filter((row) => row.matchStatus === 'LISTO');
  const prisma = new PrismaClient();
  const results = [];
  try {
    for (const [index, row] of ready.entries()) {
      const product = await prisma.product.findUnique({
        where: { id: row.productId },
        select: {
          id: true,
          name: true,
          images: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, url: true, alt: true } },
        },
      });
      if (!product) {
        results.push({ productId: row.productId, status: 'ERROR_NO_EXISTE' });
        continue;
      }
      if (product.images.some((image) => image.alt?.startsWith(AUTO_ALT_PREFIX))) {
        results.push({ productId: row.productId, productName: product.name, status: 'YA_CARGADA' });
        continue;
      }
      if (
        product.images.length !== row.expectedImageCount ||
        product.images[0]?.id !== row.expectedFrontImageId ||
        product.images[0]?.url !== row.expectedFrontUrl
      ) {
        results.push({ productId: row.productId, productName: product.name, status: 'ERROR_PRODUCTO_CAMBIO' });
        continue;
      }
      const sourcePath = join(stageRoot, row.stageName);
      const sourceSha = createHash('sha256').update(await readFile(sourcePath)).digest('hex');
      if (sourceSha !== row.backSha256) {
        results.push({ productId: row.productId, productName: product.name, status: 'ERROR_HASH' });
        continue;
      }
      if (!shouldApply) {
        results.push({ productId: row.productId, productName: product.name, status: 'VALIDADO_DRY_RUN' });
        continue;
      }
      const uploadDirectory = resolve(process.cwd(), 'uploads', 'products');
      await mkdir(uploadDirectory, { recursive: true });
      const filename = `${randomUUID()}.webp`;
      const outputFile = join(uploadDirectory, filename);
      try {
        if (row.stagedProcessed) await copyFile(sourcePath, outputFile);
        else await processBackImage(sourcePath, outputFile);
        const position = product.images.length;
        await prisma.productImage.create({
          data: {
            productId: product.id,
            url: `/uploads/products/${filename}`,
            alt: `${AUTO_ALT_PREFIX} Espalda · ${row.folder} · sha256:${row.backSha256}`,
            position,
          },
        });
        results.push({ productId: row.productId, productName: product.name, status: 'CARGADA', url: `/uploads/products/${filename}` });
      } catch (error) {
        await rm(outputFile, { force: true });
        results.push({ productId: row.productId, productName: product.name, status: 'ERROR_CARGA', error: error instanceof Error ? error.message : String(error) });
      }
      if ((index + 1) % 50 === 0) process.stderr.write(`${shouldApply ? 'Cargadas' : 'Validadas'} ${index + 1}/${ready.length}\n`);
    }
    const summary = results.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});
    await writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), apply: shouldApply, summary, results }, null, 2));
    console.log(JSON.stringify({ outputPath, apply: shouldApply, summary }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'export') return exportProducts();
  if (mode === 'match') return matchProducts();
  if (mode === 'prepare') return prepareStage();
  if (mode === 'apply') return applyManifest();
  throw new Error('Uso: node product-backs.mjs <export|match|prepare|apply> [opciones]');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
