import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const scopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "recurring_billing.read",
    module: "recurring_billing",
    action: "read",
    description: "Melihat recurring billing",
    allowedScopes: scopes,
  },
  {
    code: "recurring_billing.create",
    module: "recurring_billing",
    action: "create",
    description: "Membuat recurring billing",
    allowedScopes: scopes,
  },
  {
    code: "recurring_billing.update",
    module: "recurring_billing",
    action: "update",
    description: "Mengubah dan mengaktifkan recurring billing",
    allowedScopes: scopes,
  },
]);
