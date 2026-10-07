import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "contract.read",
    module: "contract",
    action: "read",
    description: "Melihat data contract",
  },
  {
    code: "contract.create",
    module: "contract",
    action: "create",
    description: "Membuat contract",
  },
  {
    code: "contract.update",
    module: "contract",
    action: "update",
    description: "Mengubah contract",
  },
  {
    code: "contract.delete",
    module: "contract",
    action: "delete",
    description: "Menghapus contract",
  },
]);
