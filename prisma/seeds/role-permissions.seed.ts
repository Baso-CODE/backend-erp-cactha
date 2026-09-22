// prisma/seeds/role-permissions.seed.ts

import { AccessScope, PrismaClient } from "@prisma/client";

type RolePermissionConfig = {
  permission: string;
  scope: AccessScope;
};

const rolePermissions: Record<string, RolePermissionConfig[]> = {
  OWNER: [
    // ADMIN
    { permission: "admin.user.read", scope: AccessScope.ALL },
    { permission: "admin.user.create", scope: AccessScope.ALL },
    { permission: "admin.user.update", scope: AccessScope.ALL },
    { permission: "admin.user.delete", scope: AccessScope.ALL },

    { permission: "admin.role.read", scope: AccessScope.ALL },
    { permission: "admin.role.create", scope: AccessScope.ALL },
    { permission: "admin.role.update", scope: AccessScope.ALL },
    { permission: "admin.role.delete", scope: AccessScope.ALL },

    { permission: "admin.permission.read", scope: AccessScope.ALL },
    { permission: "admin.permission.manage", scope: AccessScope.ALL },

    { permission: "admin.audit.read", scope: AccessScope.ALL },

    // CRM - LEAD
    { permission: "crm.lead.read", scope: AccessScope.ALL },
    { permission: "crm.lead.create", scope: AccessScope.ALL },
    { permission: "crm.lead.update", scope: AccessScope.ALL },
    { permission: "crm.lead.delete", scope: AccessScope.ALL },
    { permission: "crm.lead.assign", scope: AccessScope.ALL },

    // CRM - ACTIVITY
    { permission: "crm.activity.read", scope: AccessScope.ALL },
    { permission: "crm.activity.create", scope: AccessScope.ALL },
    { permission: "crm.activity.update", scope: AccessScope.ALL },
    { permission: "crm.activity.delete", scope: AccessScope.ALL },

    // CRM - PROPOSAL
    { permission: "crm.proposal.read", scope: AccessScope.ALL },
    { permission: "crm.proposal.create", scope: AccessScope.ALL },
    { permission: "crm.proposal.update", scope: AccessScope.ALL },
    { permission: "crm.proposal.delete", scope: AccessScope.ALL },

    // CRM - QUOTATION
    { permission: "crm.quotation.read", scope: AccessScope.ALL },
    { permission: "crm.quotation.create", scope: AccessScope.ALL },
    { permission: "crm.quotation.update", scope: AccessScope.ALL },
    { permission: "crm.quotation.delete", scope: AccessScope.ALL },
  ],

  ADMIN: [
    // ADMIN
    { permission: "admin.user.read", scope: AccessScope.ALL },
    { permission: "admin.user.create", scope: AccessScope.ALL },
    { permission: "admin.user.update", scope: AccessScope.ALL },

    { permission: "admin.role.read", scope: AccessScope.ALL },
    { permission: "admin.permission.read", scope: AccessScope.ALL },
    { permission: "admin.audit.read", scope: AccessScope.ALL },

    // CRM - LEAD
    { permission: "crm.lead.read", scope: AccessScope.ALL },
    { permission: "crm.lead.create", scope: AccessScope.ALL },
    { permission: "crm.lead.update", scope: AccessScope.ALL },
    { permission: "crm.lead.assign", scope: AccessScope.ALL },

    // CRM - ACTIVITY
    { permission: "crm.activity.read", scope: AccessScope.ALL },
    { permission: "crm.activity.create", scope: AccessScope.ALL },
    { permission: "crm.activity.update", scope: AccessScope.ALL },

    // CRM - PROPOSAL
    { permission: "crm.proposal.read", scope: AccessScope.ALL },
    { permission: "crm.proposal.create", scope: AccessScope.ALL },
    { permission: "crm.proposal.update", scope: AccessScope.ALL },

    // CRM - QUOTATION
    { permission: "crm.quotation.read", scope: AccessScope.ALL },
    { permission: "crm.quotation.create", scope: AccessScope.ALL },
    { permission: "crm.quotation.update", scope: AccessScope.ALL },
  ],

  SALES_MANAGER: [
    // CRM - LEAD
    { permission: "crm.lead.read", scope: AccessScope.ALL },
    { permission: "crm.lead.create", scope: AccessScope.ALL },
    { permission: "crm.lead.update", scope: AccessScope.ALL },
    { permission: "crm.lead.assign", scope: AccessScope.ALL },

    // CRM - ACTIVITY
    { permission: "crm.activity.read", scope: AccessScope.ALL },
    { permission: "crm.activity.create", scope: AccessScope.ALL },
    { permission: "crm.activity.update", scope: AccessScope.ALL },
    { permission: "crm.activity.delete", scope: AccessScope.ALL },

    // CRM - PROPOSAL
    { permission: "crm.proposal.read", scope: AccessScope.ALL },
    { permission: "crm.proposal.create", scope: AccessScope.ALL },
    { permission: "crm.proposal.update", scope: AccessScope.ALL },
    { permission: "crm.proposal.delete", scope: AccessScope.ALL },

    // CRM - QUOTATION
    { permission: "crm.quotation.read", scope: AccessScope.ALL },
    { permission: "crm.quotation.create", scope: AccessScope.ALL },
    { permission: "crm.quotation.update", scope: AccessScope.ALL },
    { permission: "crm.quotation.delete", scope: AccessScope.ALL },
  ],

  SALES_EXECUTIVE: [
    // CRM - LEAD
    { permission: "crm.lead.read", scope: AccessScope.OWN },
    { permission: "crm.lead.create", scope: AccessScope.OWN },
    { permission: "crm.lead.update", scope: AccessScope.OWN },

    // CRM - ACTIVITY
    { permission: "crm.activity.read", scope: AccessScope.OWN },
    { permission: "crm.activity.create", scope: AccessScope.OWN },
    { permission: "crm.activity.update", scope: AccessScope.OWN },

    // CRM - PROPOSAL
    { permission: "crm.proposal.read", scope: AccessScope.OWN },
    { permission: "crm.proposal.create", scope: AccessScope.OWN },
    { permission: "crm.proposal.update", scope: AccessScope.OWN },

    // CRM - QUOTATION
    { permission: "crm.quotation.read", scope: AccessScope.OWN },
    { permission: "crm.quotation.create", scope: AccessScope.OWN },
    { permission: "crm.quotation.update", scope: AccessScope.OWN },
  ],

  ACCOUNT_MANAGER: [],
  PROJECT_MANAGER: [],
  SPECIALIST: [],
  DESIGNER: [],
  EDITOR: [],
  TALENT: [],
  FINANCE: [],
  CLIENT: [],
};

export async function seedRolePermissions(prisma: PrismaClient) {
  for (const [roleCode, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({
      where: {
        code: roleCode,
      },
    });

    if (!role) {
      console.warn(`Role "${roleCode}" tidak ditemukan. Dilewati.`);
      continue;
    }

    for (const item of permissions) {
      const permission = await prisma.permission.findUnique({
        where: {
          code: item.permission,
        },
      });

      if (!permission) {
        console.warn(
          `Permission "${item.permission}" tidak ditemukan untuk role "${roleCode}". Dilewati.`,
        );
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {
          scope: item.scope,
        },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          scope: item.scope,
        },
      });
    }
  }

  console.log("Role permission seed selesai.");
}
