import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const contractScopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "contract.read",
    module: "contract",
    action: "read",
    description: "Melihat data contract",
    allowedScopes: contractScopes,
  },
  {
    code: "contract.create",
    module: "contract",
    action: "create",
    description: "Membuat contract",
    allowedScopes: contractScopes,
  },
  {
    code: "contract.update",
    module: "contract",
    action: "update",
    description: "Mengubah contract",
    allowedScopes: contractScopes,
  },
  {
    code: "contract.delete",
    module: "contract",
    action: "delete",
    description: "Menghapus contract",
    allowedScopes: contractScopes,
  },
]);
