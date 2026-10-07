import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const quotationScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "crm.quotation.read",
    module: "crm.quotation",
    action: "read",
    description: "Melihat quotation",
    allowedScopes: quotationScopes,
  },
  {
    code: "crm.quotation.create",
    module: "crm.quotation",
    action: "create",
    description: "Membuat quotation",
    allowedScopes: quotationScopes,
  },
  {
    code: "crm.quotation.update",
    module: "crm.quotation",
    action: "update",
    description: "Mengubah quotation",
    allowedScopes: quotationScopes,
  },
  {
    code: "crm.quotation.delete",
    module: "crm.quotation",
    action: "delete",
    description: "Menghapus quotation",
    allowedScopes: quotationScopes,
  },
]);
