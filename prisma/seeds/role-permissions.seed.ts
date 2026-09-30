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

    // CLIENT
    { permission: "client.read", scope: AccessScope.ALL },
    { permission: "client.create", scope: AccessScope.ALL },
    { permission: "client.update", scope: AccessScope.ALL },
    { permission: "client.delete", scope: AccessScope.ALL },
    { permission: "client.assign", scope: AccessScope.ALL },

    // CLIENT - CONTACT PERSON
    { permission: "client.contact.read", scope: AccessScope.ALL },
    { permission: "client.contact.create", scope: AccessScope.ALL },
    { permission: "client.contact.update", scope: AccessScope.ALL },
    { permission: "client.contact.delete", scope: AccessScope.ALL },

    // CONTRACT
    { permission: "contract.read", scope: AccessScope.ALL },
    { permission: "contract.create", scope: AccessScope.ALL },
    { permission: "contract.update", scope: AccessScope.ALL },
    { permission: "contract.delete", scope: AccessScope.ALL },
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

    // CLIENT
    { permission: "client.read", scope: AccessScope.ALL },
    { permission: "client.create", scope: AccessScope.ALL },
    { permission: "client.update", scope: AccessScope.ALL },
    { permission: "client.assign", scope: AccessScope.ALL },

    // CLIENT - CONTACT PERSON
    { permission: "client.contact.read", scope: AccessScope.ALL },
    { permission: "client.contact.create", scope: AccessScope.ALL },
    { permission: "client.contact.update", scope: AccessScope.ALL },
    { permission: "client.contact.delete", scope: AccessScope.ALL },

    // CONTRACT
    { permission: "contract.read", scope: AccessScope.ALL },
    { permission: "contract.create", scope: AccessScope.ALL },
    { permission: "contract.update", scope: AccessScope.ALL },
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

    { permission: "client.read", scope: AccessScope.ALL },
    { permission: "client.contact.read", scope: AccessScope.ALL },
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

    { permission: "client.read", scope: AccessScope.OWN },
    { permission: "client.contact.read", scope: AccessScope.OWN },
  ],

  ACCOUNT_MANAGER: [
    // CLIENT
    { permission: "client.read", scope: AccessScope.OWN },
    { permission: "client.create", scope: AccessScope.OWN },
    { permission: "client.update", scope: AccessScope.OWN },

    // CLIENT - CONTACT PERSON
    { permission: "client.contact.read", scope: AccessScope.OWN },
    { permission: "client.contact.create", scope: AccessScope.OWN },
    { permission: "client.contact.update", scope: AccessScope.OWN },
    { permission: "client.contact.delete", scope: AccessScope.OWN },

    // CONTRACT
    { permission: "contract.read", scope: AccessScope.OWN },
    { permission: "contract.create", scope: AccessScope.OWN },
    { permission: "contract.update", scope: AccessScope.OWN },
  ],
  PROJECT_MANAGER: [
    { permission: "client.read", scope: AccessScope.ALL },
    { permission: "client.contact.read", scope: AccessScope.ALL },
    { permission: "contract.read", scope: AccessScope.ALL },
  ],
  SPECIALIST: [],
  DESIGNER: [],
  EDITOR: [],
  TALENT: [],
  FINANCE: [
    { permission: "client.read", scope: AccessScope.ALL },
    { permission: "client.contact.read", scope: AccessScope.ALL },
    { permission: "contract.read", scope: AccessScope.ALL },
  ],
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
