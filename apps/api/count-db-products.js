const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.product.count();
  const products = await prisma.product.findMany({
    select: { name: true, slug: true }
  });
  console.log('PRODUCTS_COUNT_IN_DB:', count);
  console.log('PRODUCTS_IN_DB:', products);
}
main().catch(console.error).finally(() => prisma.$disconnect());
