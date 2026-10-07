import { AccessScope } from "@prisma/client";

import { definePermissions } from "../rbac/dto/permission-registry.types";

const invoiceScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "invoice.read",
    module: "invoice",
    action: "read",
    description: "Melihat data invoice",
    allowedScopes: invoiceScopes,
  },
  {
    code: "invoice.create",
    module: "invoice",
    action: "create",
    description: "Membuat invoice",
    allowedScopes: invoiceScopes,
  },
  {
    code: "invoice.update",
    module: "invoice",
    action: "update",
    description: "Mengubah invoice",
    allowedScopes: invoiceScopes,
  },
  {
    code: "invoice.delete",
    module: "invoice",
    action: "delete",
    description: "Menghapus invoice",
    allowedScopes: invoiceScopes,
  },
]);
