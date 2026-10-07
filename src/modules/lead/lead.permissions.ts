import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "crm.lead.read",
    module: "crm.lead",
    action: "read",
    description: "Melihat data lead",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "crm.lead.create",
    module: "crm.lead",
    action: "create",
    description: "Membuat lead",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "crm.lead.update",
    module: "crm.lead",
    action: "update",
    description: "Mengubah lead",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "crm.lead.delete",
    module: "crm.lead",
    action: "delete",
    description: "Menghapus lead",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "crm.lead.assign",
    module: "crm.lead",
    action: "assign",
    description: "Assign lead ke sales",
    allowedScopes: [AccessScope.ALL],
  },
]);
