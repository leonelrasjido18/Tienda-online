/**
 * Proceso masivo: completa COLOR y TIPOGRAFÍA del estampado con IA, usando la
 * Batch API de Anthropic (50% más barata). NO toca las zonas de impresión: esas
 * quedan con las medidas estándar ya aplicadas.
 *
 * La foto analizada es siempre la asignada en la plantilla (la espalda, 2ª foto).
 *
 * Uso (dentro del contenedor api):
 *   node dist/scripts/ai-style-products.js --limit 10      # DRY-RUN de 10
 *   node dist/scripts/ai-style-products.js --limit 10 --apply
 *   node dist/scripts/ai-style-products.js --apply          # todas
 */
import { writeFileSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { CustomizationAnalysis } from '@tienda/shared';

import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyzerService } from '../catalog/customization/analyzer.service';

const ANTHROPIC_BASE = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_VERSION = '2023-06-01';
const CHUNK_SIZE = 200;
const POLL_INTERVAL_MS = 15_000;
const PRICE_IN_PER_MTOK = 1.5;
const PRICE_OUT_PER_MTOK = 7.5;

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
const hasFlag = (name: string) => process.argv.includes(`--${name}`);
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const apply = hasFlag('apply');
  const limitRaw = arg('limit');
  const limit = limitRaw ? Number(limitRaw) : undefined;

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const analyzer = app.get(AnalyzerService);
  const config = app.get(ConfigService);

  const apiKey = config.get<string>('ANTHROPIC_API_KEY');
  const workspaceId = config.get<string>('ANTHROPIC_WORKSPACE_ID');
  if (!apiKey) {
    console.error('Falta ANTHROPIC_API_KEY.');
    await app.close();
    process.exit(1);
  }
  const headers: Record<string, string> = {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'content-type': 'application/json',
    ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
  };

  // Plantillas con foto de espalda asignada.
  const templates = await prisma.customizationTemplate.findMany({
    where: { customizationImageId: { not: null } },
    select: {
      id: true,
      productId: true,
      customizationImage: { select: { url: true } },
      product: { select: { name: true } },
    },
    orderBy: { productId: 'asc' },
    ...(limit ? { take: limit } : {}),
  });
  console.log(`Plantillas a analizar: ${templates.length}${apply ? '' : '  (DRY-RUN, no se escribe)'}`);
  if (templates.length === 0) {
    await app.close();
    return;
  }

  console.log('Preparando imágenes…');
  const requests: { custom_id: string; params: Record<string, unknown> }[] = [];
  let prepared = 0;
  for (const t of templates) {
    const url = t.customizationImage?.url;
    if (!url) continue;
    try {
      const base64 = await analyzer.prepareImageBase64(url);
      requests.push({ custom_id: t.id, params: analyzer.buildMessageBody(base64) });
    } catch (e) {
      console.warn(`  ! Foto ilegible en ${t.product.name}: ${(e as Error).message}`);
    }
    if (++prepared % 100 === 0) console.log(`  … ${prepared}/${templates.length}`);
  }
  console.log(`Requests armadas: ${requests.length}`);

  const analyses = new Map<string, CustomizationAnalysis>();
  const failed: { id: string; reason: string }[] = [];
  let totalIn = 0;
  let totalOut = 0;

  const groups = chunk(requests, CHUNK_SIZE);
  for (const [gi, group] of groups.entries()) {
    console.log(`\nBatch ${gi + 1}/${groups.length} — enviando ${group.length}…`);
    const created = (await (
      await fetch(ANTHROPIC_BASE, { method: 'POST', headers, body: JSON.stringify({ requests: group }) })
    ).json()) as BatchResource & { error?: { message?: string } };
    if (!created.id) {
      console.error('  Error creando el batch:', JSON.stringify(created).slice(0, 300));
      continue;
    }
    console.log(`  Batch ${created.id}. Esperando…`);

    let status = created;
    while (status.processing_status !== 'ended') {
      await sleep(POLL_INTERVAL_MS);
      status = (await (await fetch(`${ANTHROPIC_BASE}/${created.id}`, { headers })).json()) as BatchResource;
      const c = status.request_counts ?? {};
      process.stdout.write(`\r  ${status.processing_status} (ok:${c.succeeded ?? 0} err:${c.errored ?? 0})   `);
    }
    console.log('\n  Descargando resultados…');
    if (!status.results_url) continue;

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
        analyses.set(parsed.custom_id, analyzer.parseAnalysis(raw));
      } catch (e) {
        failed.push({ id: parsed.custom_id, reason: `parse: ${(e as Error).message}` });
      }
    }
  }

  // Aplicar SOLO color, contorno, interletrado y tipografía.
  const report: Record<string, unknown>[] = [];
  let applied = 0;
  for (const t of templates) {
    const a = analyses.get(t.id);
    if (!a) continue;
    const fontId = await analyzer.matchFontStyle(a.fontStyle);
    report.push({
      producto: t.product.name,
      color: a.fillColor,
      contorno: a.strokeColor,
      grosor: a.strokeWidthPx,
      estilo: a.fontStyle,
      tipografiaAsignada: fontId ? 'sí' : 'NO (sin match)',
    });

    if (apply) {
      await prisma.customizationTemplate.update({
        where: { id: t.id },
        data: {
          fillColor: a.fillColor,
          strokeColor: a.strokeWidthPx > 0 ? a.strokeColor : null,
          strokeWidthPx: a.strokeWidthPx,
          letterSpacingPx: a.letterSpacingPx,
          ...(fontId ? { fontId } : {}),
        },
      });
      applied++;
    }
  }

  const cost = (totalIn / 1_000_000) * PRICE_IN_PER_MTOK + (totalOut / 1_000_000) * PRICE_OUT_PER_MTOK;
  writeFileSync('/tmp/ai-style-report.json', JSON.stringify({ report, failed }, null, 2));

  console.log('\n================ RESUMEN ================');
  console.log(`Analizadas    : ${analyses.size}`);
  console.log(`Aplicadas     : ${apply ? applied : '0 (dry-run)'}`);
  console.log(`Fallidas      : ${failed.length}`);
  console.log(`Tokens in/out : ${totalIn} / ${totalOut}`);
  console.log(`Costo (Batch) : USD ${cost.toFixed(4)}`);
  console.log('\n--- Muestra ---');
  for (const r of report.slice(0, 12)) console.log(JSON.stringify(r));

  await app.close();
  process.exit(0);
}

void main();
