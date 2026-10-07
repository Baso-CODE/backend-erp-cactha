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
    // PROJECT
    // ==========================================

    {
      code: "project.read",
      module: "project",
      action: "read",
      description: "Melihat project",
    },
    {
      code: "project.create",
      module: "project",
      action: "create",
      description: "Membuat project",
    },
    {
      code: "project.update",
      module: "project",
      action: "update",
      description: "Mengubah project",
    },
    {
      code: "project.delete",
      module: "project",
      action: "delete",
      description: "Menghapus project",
    },
    {
      code: "project.assign",
      module: "project",
      action: "assign",
      description: "Mengubah project manager",
    },

    // ==========================================
    // PROJECT SERVICE
    // ==========================================

    {
      code: "project.service.read",
      module: "project",
      action: "read",
      description: "Melihat service dalam project",
    },
    {
      code: "project.service.create",
      module: "project",
      action: "create",
      description: "Menambahkan service ke project",
    },
    {
      code: "project.service.update",
      module: "project",
      action: "update",
      description: "Mengubah service dalam project",
    },
    {
      code: "project.service.delete",
      module: "project",
      action: "delete",
      description: "Menghapus service dari project",
    },

    // ==========================================
    // TASK
    // ==========================================

    {
      code: "task.read",
      module: "task",
      action: "read",
      description: "Melihat task",
    },
    {
      code: "task.create",
      module: "task",
      action: "create",
      description: "Membuat task",
    },
    {
      code: "task.update",
      module: "task",
      action: "update",
      description: "Mengubah task",
    },
    {
      code: "task.delete",
      module: "task",
      action: "delete",
      description: "Menghapus task",
    },
    {
      code: "task.assign",
      module: "task",
      action: "assign",
      description: "Assign task ke user",
    },
    {
      code: "task.manage",
      module: "task",
      action: "manage",
      description: "Mengelola status, posisi, dan workflow task",
    },

    // ==========================================
    // TASK CHECKLIST
    // ==========================================

    {
      code: "task.checklist.create",
      module: "task",
      action: "create",
      description: "Membuat checklist task",
    },
    {
      code: "task.checklist.update",
      module: "task",
      action: "update",
      description: "Mengubah checklist task",
    },
    {
      code: "task.checklist.delete",
      module: "task",
      action: "delete",
      description: "Menghapus checklist task",
    },

    // ==========================================
    // TASK COMMENT
    // ==========================================

    {
      code: "task.comment.create",
      module: "task",
      action: "create",
      description: "Membuat komentar task",
    },
    {
      code: "task.comment.update",
      module: "task",
      action: "update",
      description: "Mengubah komentar task",
    },
    {
      code: "task.comment.delete",
      module: "task",
      action: "delete",
      description: "Menghapus komentar task",
    },

    {
      code: "task.attachment.create",
      module: "task",
      action: "create",
      description: "Menambahkan attachment ke task",
    },
    {
      code: "task.attachment.delete",
      module: "task",
      action: "delete",
      description: "Menghapus attachment task",
    },

    {
      code: "admin.team.read",
      module: "admin.team",
      action: "read",
      description: "Melihat daftar dan detail team",
    },
    {
      code: "admin.team.create",
      module: "admin.team",
      action: "create",
      description: "Membuat team baru",
    },
    {
      code: "admin.team.update",
      module: "admin.team",
      action: "update",
      description: "Memperbarui data team",
    },
    {
      code: "admin.team.delete",
      module: "admin.team",
      action: "delete",
      description: "Menghapus team",
    },
    {
      code: "admin.team.manage_member",
      module: "admin.team",
      action: "manage_member",
      description: "Menambahkan dan menghapus anggota team",
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
