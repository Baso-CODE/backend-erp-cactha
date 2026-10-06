import "dotenv/config";

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

import { seedPermissions } from "./seeds/permission.seed";
import { seedRolePermissions } from "./seeds/role-permissions.seed";
import { seedRoles } from "./seeds/roles.seed";
import { seedUsers } from "./seeds/users.seed";

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
  connectionLimit: 5,
  connectTimeout: 15000,
  acquireTimeout: 30000,
  idleTimeout: 300,
});

const prisma = new PrismaClient({
  adapter,
  log: ["info", "warn", "error"],
});

async function main() {
  console.log("Menjalankan database seed...");

  await prisma.$connect();
  console.log("Prisma connected.");

  await seedRoles(prisma);
  await seedPermissions(prisma);
  await seedRolePermissions(prisma);
  await seedUsers(prisma);

  console.log("Database seed selesai.");
}

main()
  .catch((error) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
