import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "crm.activity.read",
    module: "crm.activity",
    action: "read",
    description: "Melihat activity lead",
  },
  {
    code: "crm.activity.create",
    module: "crm.activity",
    action: "create",
    description: "Membuat activity lead",
  },
  {
    code: "crm.activity.update",
    module: "crm.activity",
    action: "update",
    description: "Mengubah activity lead",
  },
  {
    code: "crm.activity.delete",
    module: "crm.activity",
    action: "delete",
    description: "Menghapus activity lead",
  },
]);
