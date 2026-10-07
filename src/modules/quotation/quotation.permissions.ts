import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "crm.quotation.read",
    module: "crm.quotation",
    action: "read",
    description: "Melihat quotation",
  },
  {
    code: "crm.quotation.create",
    module: "crm.quotation",
    action: "create",
    description: "Membuat quotation",
  },
  {
    code: "crm.quotation.update",
    module: "crm.quotation",
    action: "update",
    description: "Mengubah quotation",
  },
  {
    code: "crm.quotation.delete",
    module: "crm.quotation",
    action: "delete",
    description: "Menghapus quotation",
  },
]);
