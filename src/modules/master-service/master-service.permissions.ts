import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "master.service.read",
    module: "master.service",
    action: "read",
    description: "Melihat master service",
  },
  {
    code: "master.service.create",
    module: "master.service",
    action: "create",
    description: "Membuat master service",
  },
  {
    code: "master.service.update",
    module: "master.service",
    action: "update",
    description: "Mengubah master service",
  },
  {
    code: "master.service.delete",
    module: "master.service",
    action: "delete",
    description: "Menghapus master service",
  },
]);
