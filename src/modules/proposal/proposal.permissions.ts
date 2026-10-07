import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const proposalScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "crm.proposal.read",
    module: "crm.proposal",
    action: "read",
    description: "Melihat proposal",
    allowedScopes: proposalScopes,
  },
  {
    code: "crm.proposal.create",
    module: "crm.proposal",
    action: "create",
    description: "Membuat proposal",
    allowedScopes: proposalScopes,
  },
  {
    code: "crm.proposal.update",
    module: "crm.proposal",
    action: "update",
    description: "Mengubah proposal",
    allowedScopes: proposalScopes,
  },
  {
    code: "crm.proposal.delete",
    module: "crm.proposal",
    action: "delete",
    description: "Menghapus proposal",
    allowedScopes: proposalScopes,
  },
]);
