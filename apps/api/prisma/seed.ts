import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { generateVariantCombinations, suggestSku } from '../src/catalog/products/variant-generator';

const prisma = new PrismaClient();

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

  console.log(`Catálogo demo listo. Producto: ${demoProduct.name} (${demoProduct.slug})`);
  console.log(`Equipos: ${liverpool.name}, ${realMadrid.name}, ${argentina.name}`);
}

async function main() {
  await seedOwner();
  await seedCatalog();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
