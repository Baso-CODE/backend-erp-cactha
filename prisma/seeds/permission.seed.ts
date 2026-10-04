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

    // ==========================================
    // CLIENT
    // ==========================================

    {
      code: "client.read",
      module: "client",
      action: "read",
      description: "Melihat data client",
    },
    {
      code: "client.create",
      module: "client",
      action: "create",
      description: "Membuat client",
    },
    {
      code: "client.update",
      module: "client",
      action: "update",
      description: "Mengubah client",
    },
    {
      code: "client.delete",
      module: "client",
      action: "delete",
      description: "Menghapus client",
    },
    {
      code: "client.assign",
      module: "client",
      action: "assign",
      description: "Assign account manager ke client",
    },

    // ==========================================
    // CLIENT - CONTACT PERSON
    // ==========================================

    {
      code: "client.contact.read",
      module: "client",
      action: "read",
      description: "Melihat contact person client",
    },
    {
      code: "client.contact.create",
      module: "client",
      action: "create",
      description: "Membuat contact person client",
    },
    {
      code: "client.contact.update",
      module: "client",
      action: "update",
      description: "Mengubah contact person client",
    },
    {
      code: "client.contact.delete",
      module: "client",
      action: "delete",
      description: "Menghapus contact person client",
    },

    // ==========================================
    // CONTRACT
    // ==========================================

    {
      code: "contract.read",
      module: "contract",
      action: "read",
      description: "Melihat data contract",
    },
    {
      code: "contract.create",
      module: "contract",
      action: "create",
      description: "Membuat contract",
    },
    {
      code: "contract.update",
      module: "contract",
      action: "update",
      description: "Mengubah contract",
    },
    {
      code: "contract.delete",
      module: "contract",
      action: "delete",
      description: "Menghapus contract",
    },

    // ==========================================
    // MASTER DATA - SERVICE
    // ==========================================

    {
      code: "master.service.read",
      module: "master",
      action: "read",
      description: "Melihat master service",
    },
    {
      code: "master.service.create",
      module: "master",
      action: "create",
      description: "Membuat master service",
    },
    {
      code: "master.service.update",
      module: "master",
      action: "update",
      description: "Mengubah master service",
    },
    {
      code: "master.service.delete",
      module: "master",
      action: "delete",
      description: "Menghapus master service",
    },

    // ==========================================
    // WORKFLOW TEMPLATE
    // ==========================================

    {
      code: "workflow.template.read",
      module: "workflow",
      action: "read",
      description: "Melihat workflow template",
    },
    {
      code: "workflow.template.create",
      module: "workflow",
      action: "create",
      description: "Membuat workflow template",
    },
    {
      code: "workflow.template.update",
      module: "workflow",
      action: "update",
      description: "Mengubah workflow template",
    },
    {
      code: "workflow.template.delete",
      module: "workflow",
      action: "delete",
      description: "Menghapus workflow template",
    },

    // ==========================================
    // WORKFLOW INSTANCE
    // ==========================================

    {
      code: "workflow.instance.read",
      module: "workflow",
      action: "read",
      description: "Melihat workflow instance",
    },
    {
      code: "workflow.instance.create",
      module: "workflow",
      action: "create",
      description: "Membuat workflow instance",
    },
    {
      code: "workflow.instance.update",
      module: "workflow",
      action: "update",
      description: "Mengubah workflow instance",
    },
    {
      code: "workflow.instance.delete",
      module: "workflow",
      action: "delete",
      description: "Menghapus workflow instance",
    },
    {
      code: "workflow.instance.manage",
      module: "workflow",
      action: "manage",
      description: "Mengelola status dan current step workflow instance",
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
