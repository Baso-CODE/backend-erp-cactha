// prisma/seeds/permissions.seed.ts

import { PrismaClient } from "@prisma/client";

export async function seedPermissions(prisma: PrismaClient) {
  const permissions = [
    // ==========================================
    // ADMIN - USER
    // ==========================================

    {
      code: "admin.user.read",
      module: "admin",
      action: "read",
      description: "Melihat data user",
    },
    {
      code: "admin.user.create",
      module: "admin",
      action: "create",
      description: "Membuat user",
    },
    {
      code: "admin.user.update",
      module: "admin",
      action: "update",
      description: "Mengubah user",
    },
    {
      code: "admin.user.delete",
      module: "admin",
      action: "delete",
      description: "Menghapus user",
    },

    // ==========================================
    // ADMIN - ROLE
    // ==========================================

    {
      code: "admin.role.read",
      module: "admin",
      action: "read",
      description: "Melihat role",
    },
    {
      code: "admin.role.create",
      module: "admin",
      action: "create",
      description: "Membuat role",
    },
    {
      code: "admin.role.update",
      module: "admin",
      action: "update",
      description: "Mengubah role",
    },
    {
      code: "admin.role.delete",
      module: "admin",
      action: "delete",
      description: "Menghapus role",
    },

    // ==========================================
    // ADMIN - PERMISSION
    // ==========================================

    {
      code: "admin.permission.read",
      module: "admin",
      action: "read",
      description: "Melihat permission",
    },
    {
      code: "admin.permission.manage",
      module: "admin",
      action: "manage",
      description: "Mengelola permission",
    },

    // ==========================================
    // ADMIN - AUDIT LOG
    // ==========================================

    {
      code: "admin.audit.read",
      module: "admin",
      action: "read",
      description: "Melihat audit log",
    },

    // ==========================================
    // CRM - LEAD
    // ==========================================

    {
      code: "crm.lead.read",
      module: "crm",
      action: "read",
      description: "Melihat data lead",
    },
    {
      code: "crm.lead.create",
      module: "crm",
      action: "create",
      description: "Membuat lead",
    },
    {
      code: "crm.lead.update",
      module: "crm",
      action: "update",
      description: "Mengubah lead",
    },
    {
      code: "crm.lead.delete",
      module: "crm",
      action: "delete",
      description: "Menghapus lead",
    },
    {
      code: "crm.lead.assign",
      module: "crm",
      action: "assign",
      description: "Assign lead ke sales",
    },

    // ==========================================
    // CRM - ACTIVITY
    // ==========================================

    {
      code: "crm.activity.read",
      module: "crm",
      action: "read",
      description: "Melihat activity lead",
    },
    {
      code: "crm.activity.create",
      module: "crm",
      action: "create",
      description: "Membuat activity lead",
    },
    {
      code: "crm.activity.update",
      module: "crm",
      action: "update",
      description: "Mengubah activity lead",
    },
    {
      code: "crm.activity.delete",
      module: "crm",
      action: "delete",
      description: "Menghapus activity lead",
    },

    // ==========================================
    // CRM - PROPOSAL
    // ==========================================
    {
      code: "crm.proposal.read",
      module: "crm",
      action: "read",
      description: "Melihat proposal",
    },
    {
      code: "crm.proposal.create",
      module: "crm",
      action: "create",
      description: "Membuat proposal",
    },
    {
      code: "crm.proposal.update",
      module: "crm",
      action: "update",
      description: "Mengubah proposal",
    },
    {
      code: "crm.proposal.delete",
      module: "crm",
      action: "delete",
      description: "Menghapus proposal",
    },

    // ==========================================
    // CRM - QUOTATION
    // ==========================================
    {
      code: "crm.quotation.read",
      module: "crm",
      action: "read",
      description: "Melihat quotation",
    },
    {
      code: "crm.quotation.create",
      module: "crm",
      action: "create",
      description: "Membuat quotation",
    },
    {
      code: "crm.quotation.update",
      module: "crm",
      action: "update",
      description: "Mengubah quotation",
    },
    {
      code: "crm.quotation.delete",
      module: "crm",
      action: "delete",
      description: "Menghapus quotation",
    },
  ];

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
      create: permission,
    });
  }

  console.log("Permission seed selesai.");
}
