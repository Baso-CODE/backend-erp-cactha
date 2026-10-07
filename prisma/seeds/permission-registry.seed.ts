import { PrismaClient } from "@prisma/client";
import path from "path";

import { PermissionRegistryLoader } from "../../src/modules/rbac/permission-registry.loader";

export async function seedPermissionRegistry(prisma: PrismaClient) {
  const modulesPath = path.resolve(process.cwd(), "src/modules");

  const permissions = PermissionRegistryLoader.loadFromDirectory(modulesPath);

  if (permissions.length === 0) {
    throw new Error("Tidak ada permission manifest yang ditemukan.");
  }

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        code: permission.code,
      },
      update: {
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
      create: {
        code: permission.code,
        module: permission.module,
        action: permission.action,
        description: permission.description,
      },
    });
  }

  console.log(
    `Permission registry seed selesai. ${permissions.length} permission tersinkronisasi.`,
  );
}
