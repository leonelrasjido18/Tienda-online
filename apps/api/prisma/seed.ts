import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_OWNER_EMAIL ?? 'owner@tienda.local';
  const password = process.env.SEED_OWNER_PASSWORD ?? 'changeme123';

  const passwordHash = await bcrypt.hash(password, 12);

  const owner = await prisma.staffUser.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      name: 'Owner',
      role: 'OWNER',
    },
  });

  console.log(`Seed listo. Usuario owner: ${owner.email} / password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
