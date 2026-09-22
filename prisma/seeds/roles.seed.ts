// prisma/seeds/roles.seed.ts

import { PrismaClient } from "@prisma/client";

export async function seedRoles(prisma: PrismaClient) {
  const roles = [
    {
      code: "OWNER",
      name: "Owner",
      description: "Akses penuh ke seluruh sistem",
      isSystem: true,
      isActive: true,
    },
    {
      code: "ADMIN",
      name: "Administrator",
      description: "Mengelola user, role, permission, dan konfigurasi sistem",
      isSystem: true,
      isActive: true,
    },
    {
      code: "SALES_MANAGER",
      name: "Sales Manager",
      description: "Mengelola tim sales dan seluruh lead dalam scope tim",
      isSystem: true,
      isActive: true,
    },
    {
      code: "SALES_EXECUTIVE",
      name: "Sales Executive",
      description: "Mengelola lead yang menjadi tanggung jawabnya",
      isSystem: true,
      isActive: true,
    },
    {
      code: "ACCOUNT_MANAGER",
      name: "Account Manager",
      description: "Mengelola client dan hubungan account",
      isSystem: true,
      isActive: true,
    },
    {
      code: "PROJECT_MANAGER",
      name: "Project Manager",
      description: "Mengelola project dan operasional project",
      isSystem: true,
      isActive: true,
    },
    {
      code: "SPECIALIST",
      name: "Specialist",
      description: "Menangani pekerjaan specialist dalam project",
      isSystem: true,
      isActive: true,
    },
    {
      code: "DESIGNER",
      name: "Designer",
      description: "Menangani pekerjaan desain",
      isSystem: true,
      isActive: true,
    },
    {
      code: "EDITOR",
      name: "Editor",
      description: "Menangani pekerjaan editing",
      isSystem: true,
      isActive: true,
    },
    {
      code: "TALENT",
      name: "Talent",
      description: "Menangani pekerjaan talent",
      isSystem: true,
      isActive: true,
    },
    {
      code: "FINANCE",
      name: "Finance",
      description: "Mengelola invoice, payment, dan kebutuhan finance",
      isSystem: true,
      isActive: true,
    },
    {
      code: "CLIENT",
      name: "Client",
      description: "Akses ke client portal",
      isSystem: true,
      isActive: true,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },
      update: {
        name: role.name,
        description: role.description,
        isSystem: role.isSystem,
        isActive: role.isActive,
      },
      create: role,
    });
  }

  console.log("Role seed selesai.");
}
