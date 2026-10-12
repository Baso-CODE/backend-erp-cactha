import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { seedPermissionRegistry } from "./seeds/permission-registry.seed";
import { seedRolePermissions } from "./seeds/role-permissions.seed";
import { seedRoles } from "./seeds/roles.seed";
import { seedUsers } from "./seeds/users.seed";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL belum dikonfigurasi.");
}

if (
  !databaseUrl.startsWith("postgresql://") &&
  !databaseUrl.startsWith("postgres://")
) {
  throw new Error("DATABASE_URL harus menggunakan PostgreSQL.");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
  max: 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

const prisma = new PrismaClient({
  adapter,
  log: ["warn", "error"],
});

async function main() {
  console.log("Menjalankan PostgreSQL database seed...");

  await prisma.$connect();
  console.log("PostgreSQL connected.");

  await seedRoles(prisma);
  await seedPermissionRegistry(prisma);
  await seedRolePermissions(prisma);
  await seedUsers(prisma);

  console.log("PostgreSQL database seed selesai.");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
