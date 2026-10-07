import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const activityScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "crm.activity.read",
    module: "crm.activity",
    action: "read",
    description: "Melihat activity lead",
    allowedScopes: activityScopes,
  },
  {
    code: "crm.activity.create",
    module: "crm.activity",
    action: "create",
    description: "Membuat activity lead",
    allowedScopes: activityScopes,
  },
  {
    code: "crm.activity.update",
    module: "crm.activity",
    action: "update",
    description: "Mengubah activity lead",
    allowedScopes: activityScopes,
  },
  {
    code: "crm.activity.delete",
    module: "crm.activity",
    action: "delete",
    description: "Menghapus activity lead",
    allowedScopes: activityScopes,
  },
]);
