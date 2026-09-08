import { Role } from "@prisma/client";
import * as argon2 from "argon2";
import "dotenv/config";
import "reflect-metadata";
import { container } from "tsyringe";
import { PrismaService } from "../src/modules/prisma/prisma.service";

async function main() {
  const prisma = container.resolve(PrismaService);

  // 1. Definisikan kredensial Super Admin / Owner
  const email = "superadmin@catha.co.id";
  const name = "Catha Owner";
  const rawPassword = "Admin123!";

  // 2. Hash password menggunakan argon2
  const hashedPassword = await argon2.hash(rawPassword, {
    type: argon2.argon2id,
  });

  // 3. Upsert User dengan Role enum OWNER
  const superAdmin = await prisma.user.upsert({
    where: { email: email },
    update: {
      name: name,
      password: hashedPassword,
      role: Role.OWNER,
      isActive: true,
    },
    create: {
      email: email,
      name: name,
      password: hashedPassword,
      role: Role.OWNER,
      isActive: true,
    },
  });

  console.log(`✅ Owner / Super Admin berhasil disuntikkan!`);
  console.log(`- Email: ${superAdmin.email}`);
  console.log(`- Role: ${superAdmin.role}`);
}

main()
  .catch((e) => {
    console.error("❌ Gagal melakukan seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    const prisma = container.resolve(PrismaService);
    await prisma.$disconnect();
  });
