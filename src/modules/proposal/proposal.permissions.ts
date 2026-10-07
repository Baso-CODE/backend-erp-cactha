import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "crm.proposal.read",
    module: "crm.proposal",
    action: "read",
    description: "Melihat proposal",
  },
  {
    code: "crm.proposal.create",
    module: "crm.proposal",
    action: "create",
    description: "Membuat proposal",
  },
  {
    code: "crm.proposal.update",
    module: "crm.proposal",
    action: "update",
    description: "Mengubah proposal",
  },
  {
    code: "crm.proposal.delete",
    module: "crm.proposal",
    action: "delete",
    description: "Menghapus proposal",
  },
]);
