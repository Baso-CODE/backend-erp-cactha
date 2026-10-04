import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { seedPermissions } from "./seeds/permission.seed";
import { seedRolePermissions } from "./seeds/role-permissions.seed";
import { seedRoles } from "./seeds/roles.seed";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

const url = new URL(databaseUrl);

const adapter = new PrismaMariaDb({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.replace(/^\//, ""),
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("Menjalankan database seed...");

  await seedRoles(prisma);
  await seedPermissions(prisma);
  await seedRolePermissions(prisma);
  // await seedUsers(prisma);

  console.log("Database seed selesai.");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
