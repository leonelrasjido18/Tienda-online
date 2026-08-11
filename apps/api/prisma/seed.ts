import { randomUUID } from 'node:crypto';
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';

import { generateVariantCombinations, suggestSku } from '../src/catalog/products/variant-generator';

const prisma = new PrismaClient();
const UPLOADS_ROOT = join(process.cwd(), 'uploads');

// Fuente del sistema (Windows) usada sólo para tener un .ttf real en el entorno de
// desarrollo local; en producción la clienta sube sus propias tipografías.
const DEV_SYSTEM_FONT = 'C:\\Windows\\Fonts\\impact.ttf';

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL ?? 'owner@tienda.local';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'changeme123';
  const passwordHash = await bcrypt.hash(password, 12);

  const owner = await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: 'Owner', role: 'OWNER' },
  });

  console.log(`Usuario owner: ${owner.email} / password: ${password}`);
}

async function seedCatalog() {
  const premierLeague = await prisma.league.upsert({
    where: { slug: 'premier-league' },
    update: {},
    create: { name: 'Premier League', slug: 'premier-league', position: 1 },
  });
  const laLiga = await prisma.league.upsert({
    where: { slug: 'laliga' },
    update: {},
    create: { name: 'LaLiga', slug: 'laliga', position: 2 },
  });
  const selecciones = await prisma.league.upsert({
    where: { slug: 'selecciones' },
    update: {},
    create: { name: 'Selecciones', slug: 'selecciones', position: 3 },
  });

  const liverpool = await prisma.team.upsert({
    where: { slug: 'liverpool-fc' },
    update: {},
    create: { name: 'Liverpool FC', slug: 'liverpool-fc', leagueId: premierLeague.id, position: 1 },
  });
  const realMadrid = await prisma.team.upsert({
    where: { slug: 'real-madrid' },
    update: {},
    create: { name: 'Real Madrid', slug: 'real-madrid', leagueId: laLiga.id, position: 1 },
  });
  const argentina = await prisma.team.upsert({
    where: { slug: 'argentina' },
    update: {},
    create: { name: 'Argentina', slug: 'argentina', leagueId: selecciones.id, position: 1 },
  });

  const season2526 = await prisma.season.upsert({
    where: { label: '2025/26' },
    update: {},
    create: { label: '2025/26', position: 1 },
  });
  await prisma.season.upsert({
    where: { label: '2024/25' },
    update: {},
    create: { label: '2024/25', position: 2 },
  });

  const adidas = await prisma.brand.upsert({
    where: { slug: 'adidas' },
    update: {},
    create: { name: 'Adidas', slug: 'adidas' },
  });
  await prisma.brand.upsert({
    where: { slug: 'nike' },
    update: {},
    create: { name: 'Nike', slug: 'nike' },
  });

  const camisetas = await prisma.category.upsert({
    where: { slug: 'camisetas' },
    update: {},
    create: { name: 'Camisetas', slug: 'camisetas', position: 1 },
  });
  await prisma.category.upsert({
    where: { slug: 'pantalones' },
    update: {},
    create: { name: 'Pantalones', slug: 'pantalones', position: 2 },
  });

  const sizeGuide = await prisma.sizeGuide.upsert({
    where: { id: 'seed-size-guide-adulto' },
    update: {},
    create: {
      id: 'seed-size-guide-adulto',
      name: 'Talles adulto',
      contentHtml: '<table><tr><th>Talle</th><th>Pecho (cm)</th></tr><tr><td>M</td><td>96-101</td></tr></table>',
    },
  });

  const demoProduct = await prisma.product.upsert({
    where: { slug: 'camiseta-titular-argentina-2025-26' },
    update: {},
    create: {
      slug: 'camiseta-titular-argentina-2025-26',
      name: 'Camiseta Titular Argentina 2025/26',
      description: 'Camiseta titular de la Selección Argentina, temporada 2025/26.',
      status: 'ACTIVE',
      fulfillmentMode: 'BOTH',
      preorderLeadDays: 25,
      brandId: adidas.id,
      categoryId: camisetas.id,
      leagueId: selecciones.id,
      teamId: argentina.id,
      seasonId: season2526.id,
      sizeGuideId: sizeGuide.id,
      publishedAt: new Date(),
    },
  });

  const existingOptions = await prisma.productOption.findMany({ where: { productId: demoProduct.id } });
  if (existingOptions.length === 0) {
    await prisma.productOption.create({
      data: {
        productId: demoProduct.id,
        name: 'Talle',
        position: 0,
        values: {
          create: [
            { value: 'S', position: 0 },
            { value: 'M', position: 1 },
            { value: 'L', position: 2 },
            { value: 'XL', position: 3 },
          ],
        },
      },
    });
    await prisma.productOption.create({
      data: {
        productId: demoProduct.id,
        name: 'Versión',
        position: 1,
        values: { create: [{ value: 'Fan', position: 0 }, { value: 'Player', position: 1 }] },
      },
    });
  }

  const existingVariants = await prisma.productVariant.count({ where: { productId: demoProduct.id } });
  if (existingVariants === 0) {
    const options = await prisma.productOption.findMany({
      where: { productId: demoProduct.id },
      include: { values: true },
      orderBy: { position: 'asc' },
    });
    const combinations = generateVariantCombinations(
      options.map((o) => ({ id: o.id, values: o.values.map((v) => ({ id: v.id, value: v.value })) })),
    );

    for (const [index, combo] of combinations.entries()) {
      const isPlayer = combo.labels.includes('Player');
      await prisma.productVariant.create({
        data: {
          productId: demoProduct.id,
          sku: suggestSku(demoProduct.slug, combo.labels),
          priceCents: isPlayer ? 12999900 : 8999900,
          weightGrams: 220,
          position: index,
          optionValues: { create: combo.optionValueIds.map((valueId) => ({ valueId })) },
          inventory: { create: { quantity: isPlayer ? 3 : 10, allowPreorder: true, preorderLeadDays: 25 } },
        },
      });
    }
  }

  await seedProductImage(demoProduct.id);
  await seedCustomization(demoProduct.id, selecciones.id);

  console.log(`Catálogo demo listo. Producto: ${demoProduct.name} (${demoProduct.slug})`);
  console.log(`Equipos: ${liverpool.name}, ${realMadrid.name}, ${argentina.name}`);
}

async function seedProductImage(productId: string) {
  const existing = await prisma.productImage.findFirst({ where: { productId } });
  if (existing) return;

  const folder = join(UPLOADS_ROOT, 'products');
  await mkdir(folder, { recursive: true });
  const filename = `${randomUUID()}.webp`;

  // Placeholder simple (sin foto real todavía): alcanza para probar el pipeline
  // completo de personalización de punta a punta.
  await sharp({
    create: { width: 900, height: 1100, channels: 3, background: { r: 40, g: 70, b: 160 } },
  })
    .webp({ quality: 82 })
    .toFile(join(folder, filename));

  await prisma.productImage.create({
    data: { productId, url: `/uploads/products/${filename}`, alt: 'Camiseta (foto de referencia)', position: 0 },
  });
}

async function seedCustomization(productId: string, leagueId: string) {
  const existingTemplate = await prisma.customizationTemplate.findUnique({ where: { productId } });
  if (existingTemplate) return;

  let font = await prisma.leagueFont.findFirst({ where: { leagueId, name: 'Impact Dev' } });
  if (!font) {
    const folder = join(UPLOADS_ROOT, 'fonts');
    await mkdir(folder, { recursive: true });
    const filename = `${randomUUID()}.ttf`;
    try {
      await copyFile(DEV_SYSTEM_FONT, join(folder, filename));
    } catch {
      console.warn('No se encontró una fuente del sistema para el seed; se omite la personalización demo.');
      return;
    }
    font = await prisma.leagueFont.create({
      data: {
        leagueId,
        name: 'Impact Dev',
        fontFileUrl: `/uploads/fonts/${filename}`,
        fillColor: '#FFFFFF',
        strokeColor: '#0B1F4D',
        strokeWidthPx: 3,
        letterSpacingPx: 2,
      },
    });
  }

  await prisma.customizationTemplate.create({
    data: {
      productId,
      enableName: true,
      enableNumber: true,
      enablePatches: false,
      maxNameLength: 12,
      minNumber: 1,
      maxNumber: 99,
      nameExtraCents: 150000,
      numberExtraCents: 100000,
      fontId: font.id,
      // El estilo del estampado vive en la plantilla (no en la fuente).
      fillColor: '#FFFFFF',
      strokeColor: '#0B1F4D',
      strokeWidthPx: 3,
      letterSpacingPx: 2,
      namePrintArea: { x: 0.3, y: 0.22, width: 0.4, height: 0.07, rotation: 0, align: 'center' },
      numberPrintArea: { x: 0.35, y: 0.32, width: 0.3, height: 0.16, rotation: 0, align: 'center' },
    },
  });
}

async function seedStoreSettings() {
  const existing = await prisma.storeSettings.findUnique({
    where: { id: 1 },
  });
  if (existing) return;

  await prisma.storeSettings.create({
    data: {
      id: 1,
      defaultDepositPercent: 50,
      bankTransferInstructions: 'CBU: 0000000000000000000000\nAlias: remeras.del.area\nBanco: Galicia\nPor favor enviar el comprobante de pago por WhatsApp.',
      whatsappPhone: '+5491100000000',
      whatsappMessage: 'Hola! Quiero enviar el comprobante de pago de mi pedido',
      instagramUser: 'remerasdelarea',
      contactEmail: 'contacto@remerasdelarea.com.ar',
      pickupAddress: 'Av. Corrientes 1234, CABA',
      openingHours: 'Lunes a Viernes de 10 a 18 hs',
    },
  });
  console.log('Configuración de la tienda sembrada.');
}

async function seedShippingRates() {
  const provinces = [
    { province: 'CABA', priceCents: 350000, etaDays: 2 },
    { province: 'Buenos Aires', priceCents: 450000, etaDays: 4 },
    { province: 'Córdoba', priceCents: 550000, etaDays: 5 },
    { province: 'Santa Fe', priceCents: 550000, etaDays: 5 },
    { province: 'Mendoza', priceCents: 600000, etaDays: 6 },
  ];

  for (const rate of provinces) {
    await prisma.shippingRate.upsert({
      where: { province: rate.province },
      update: {},
      create: {
        province: rate.province,
        priceCents: rate.priceCents,
        etaDays: rate.etaDays,
        isActive: true,
      },
    });
  }
  console.log('Tarifas de envío por provincia sembradas.');
}

async function main() {
  await seedOwner();
  await seedCatalog();
  await seedStoreSettings();
  await seedShippingRates();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
