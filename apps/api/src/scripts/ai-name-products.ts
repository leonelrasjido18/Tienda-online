/**
 * Proceso masivo: nombra y describe productos con IA usando la Batch API de
 * Anthropic (50% más barata que las llamadas en vivo).
 *
 * Uso (dentro del contenedor api):
 *   node dist/scripts/ai-name-products.js                 # DRY-RUN (no escribe), todos
 *   node dist/scripts/ai-name-products.js --limit 8       # solo 8 (prueba)
 *   node dist/scripts/ai-name-products.js --apply          # escribe en la base
 *   node dist/scripts/ai-name-products.js --apply --limit 8
 *   node dist/scripts/ai-name-products.js --only-missing-desc --apply
 *
 * Reglas al aplicar:
 *   - confianza alta/media -> escribe nombre + descripción (regenera slug).
 *   - confianza baja         -> escribe solo la descripción, conserva el nombre,
 *                               y se lista para revisión manual.
 */
import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { ProductNameSuggestion } from '@tienda/shared';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProductNamerService } from '../catalog/products/product-namer.service';
import { ProductsService } from '../catalog/products/products.service';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_VERSION = '2023-06-01';
const CHUNK_SIZE = 200; // requests por batch
const POLL_INTERVAL_MS = 15_000;
// Precios Batch API de Sonnet (USD por millón de tokens): mitad del precio normal.
const PRICE_IN_PER_MTOK = 1.5;
const PRICE_OUT_PER_MTOK = 7.5;

interface BatchRequest {
  custom_id: string;
  params: Record<string, unknown>;
}
interface BatchResource {
  id: string;
  processing_status: string;
  results_url: string | null;
  request_counts?: Record<string, number>;
}
interface BatchResultLine {
  custom_id: string;
  result: {
    type: string;
    message?: {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    error?: { message?: string };
  };
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const next = process.argv[i + 1];
  return next && !next.startsWith('--') ? next : '';
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apply = hasFlag('apply');
  const onlyMissingDesc = hasFlag('only-missing-desc');
  const limitRaw = arg('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const namer = app.get(ProductNamerService);
  const products = app.get(ProductsService);
  const config = app.get(ConfigService);

  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  const workspaceId = config.get<string>('ANTHROPIC_WORKSPACE_ID');
  if (!apiKey) {
    console.error('Falta ANTHROPIC_API_KEY en el entorno.');
    await app.close();
    process.exit(1);
  }
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
    ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
  };

  // 1) Productos con al menos una foto.
  const rows = await prisma.product.findMany({
    where: {
      images: { some: {} },
      ...(onlyMissingDesc ? { OR: [{ description: null }, { description: '' }] } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      images: { orderBy: { position: 'asc' }, take: 1, select: { url: true } },
    },
    orderBy: { createdAt: 'asc' },
    ...(limit ? { take: limit } : {}),
  });
  console.log(`Productos a procesar: ${rows.length}${apply ? '' : '  (DRY-RUN, no se escribe)'}`);
  if (rows.length === 0) {
    await app.close();
    return;
  }

  // 2) Preparar las imágenes y armar las requests del batch.
  console.log('Preparando imágenes…');
  const requests: BatchRequest[] = [];
  let prepared = 0;
  for (const p of rows) {
    const url = p.images[0]?.url;
    if (!url) continue;
    try {
      const base64 = await namer.prepareImageBase64(url);
      requests.push({ custom_id: p.id, params: namer.buildMessageBody(base64) });
    } catch (e) {
      console.warn(`  ! No se pudo preparar la foto del producto ${p.id}: ${(e as Error).message}`);
    }
    if (++prepared % 100 === 0) console.log(`  … ${prepared}/${rows.length} imágenes listas`);
  }
  console.log(`Requests armadas: ${requests.length}`);

  // 3) Enviar en tandas y esperar cada batch.
  const suggestions = new Map<string, ProductNameSuggestion>();
  const failed: { id: string; reason: string }[] = [];
  let totalIn = 0;
  let totalOut = 0;

  const groups = chunk(requests, CHUNK_SIZE);
  for (const [gi, group] of groups.entries()) {
    console.log(`\nBatch ${gi + 1}/${groups.length} — enviando ${group.length} pedidos…`);
    const created = (await (
      await fetch(ANTHROPIC_BASE, { method: 'POST', headers, body: JSON.stringify({ requests: group }) })
    ).json()) as BatchResource & { error?: { message?: string } };
    if (!created.id) {
      console.error('  Error creando el batch:', JSON.stringify(created).slice(0, 300));
      continue;
    }
    console.log(`  Batch ${created.id} creado. Esperando resultados…`);

    // Poll
    let status = created;
    while (status.processing_status !== 'ended') {
      await sleep(POLL_INTERVAL_MS);
      status = (await (await fetch(`${ANTHROPIC_BASE}/${created.id}`, { headers })).json()) as BatchResource;
      const c = status.request_counts ?? {};
      process.stdout.write(
        `\r  estado: ${status.processing_status}  (ok:${c.succeeded ?? 0} err:${c.errored ?? 0} proc:${c.processing ?? 0})   `,
      );
    }
    console.log('\n  Batch terminado. Descargando resultados…');

    if (!status.results_url) {
      console.error('  El batch terminó sin results_url.');
      continue;
    }
    const resText = await (await fetch(status.results_url, { headers })).text();
    for (const line of resText.split('\n')) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line) as BatchResultLine;
      if (parsed.result.type !== 'succeeded' || !parsed.result.message) {
        failed.push({ id: parsed.custom_id, reason: parsed.result.error?.message ?? parsed.result.type });
        continue;
      }
      totalIn += parsed.result.message.usage?.input_tokens ?? 0;
      totalOut += parsed.result.message.usage?.output_tokens ?? 0;
      const raw = parsed.result.message.content?.find((b) => b.type === 'text')?.text ?? '';
      try {
        suggestions.set(parsed.custom_id, namer.parseSuggestion(raw));
      } catch (e) {
        failed.push({ id: parsed.custom_id, reason: `parse: ${(e as Error).message}` });
      }
    }
  }

  // 4) Aplicar (o listar en dry-run).
  const report: {
    id: string;
    oldName: string;
    newName: string;
    confidence: string;
    applied: string;
    description: string;
  }[] = [];
  const lowConfidence: typeof report = [];
  let applied = 0;

  for (const p of rows) {
    const s = suggestions.get(p.id);
    if (!s) continue;
    const useName = s.confidence !== 'baja';
    const row = {
      id: p.id,
      oldName: p.name,
      newName: s.name,
      confidence: s.confidence,
      applied: useName ? 'nombre+desc' : 'solo desc',
      description: s.description,
    };
    report.push(row);
    if (!useName) lowConfidence.push(row);

    if (apply) {
      await products.applyGeneratedContent(p.id, {
        name: useName ? s.name : undefined,
        description: s.description,
      });
      applied++;
    }
  }

  // 5) Reporte + costo real.
  const costIn = (totalIn / 1_000_000) * PRICE_IN_PER_MTOK;
  const costOut = (totalOut / 1_000_000) * PRICE_OUT_PER_MTOK;
  const reportPath = '/tmp/ai-naming-report.json';
  writeFileSync(reportPath, JSON.stringify({ report, failed }, null, 2));

  console.log('\n================ RESUMEN ================');
  console.log(`Sugerencias obtenidas : ${suggestions.size}`);
  console.log(`Aplicadas a la base   : ${apply ? applied : '0 (dry-run)'}`);
  console.log(`Confianza baja (revisar): ${lowConfidence.length}`);
  console.log(`Fallidas              : ${failed.length}`);
  console.log(`Tokens in/out         : ${totalIn} / ${totalOut}`);
  console.log(`Costo real (Batch)    : USD ${(costIn + costOut).toFixed(4)}`);
  console.log(`Reporte completo      : ${reportPath}`);
  console.log('\n--- Muestra (primeras 12) ---');
  for (const r of report.slice(0, 12)) {
    console.log(`\n[${r.confidence}] ${r.oldName}\n   -> ${r.newName}\n   ${r.description}`);
  }

  await app.close();
  process.exit(0);
}

void main();
