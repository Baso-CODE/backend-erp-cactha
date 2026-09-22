import { PrismaClient } from "@prisma/client";

import { seedPermissions } from "./seeds/permission.seed";
import { seedRolePermissions } from "./seeds/role-permissions.seed";
import { seedRoles } from "./seeds/roles.seed";

const prisma = new PrismaClient();

async function main() {
  console.log("Menjalankan database seed...");

  await seedRoles(prisma);
  await seedPermissions(prisma);
  await seedRolePermissions(prisma);

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
``;
