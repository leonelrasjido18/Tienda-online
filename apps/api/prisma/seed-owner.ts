import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Seed de PRODUCCIÓN: crea (o actualiza) únicamente la cuenta OWNER del panel, sin
// ningún dato demo. Se ejecuta una vez tras el primer deploy.
//   OWNER_EMAIL y OWNER_PASSWORD deben estar definidos en el entorno.
const prisma = new PrismaClient();

async function main() {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) {
    throw new Error('Faltan OWNER_EMAIL y/o OWNER_PASSWORD en el entorno.');
  }
  if (password.length < 10) {
    throw new Error('OWNER_PASSWORD debe tener al menos 10 caracteres.');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const owner = await prisma.staffUser.upsert({
    where: { email },
    // Si ya existe, se le actualiza la clave (útil para resetearla) y el rol.
    update: { passwordHash, role: 'OWNER' },
    create: { email, passwordHash, name: 'Owner', role: 'OWNER' },
  });

  console.log(`OWNER listo: ${owner.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
