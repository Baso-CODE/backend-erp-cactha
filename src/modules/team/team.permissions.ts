import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "admin.team.read",
    module: "admin.team",
    action: "read",
    description: "Melihat daftar dan detail team",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.team.create",
    module: "admin.team",
    action: "create",
    description: "Membuat team baru",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.team.update",
    module: "admin.team",
    action: "update",
    description: "Memperbarui data team",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.team.delete",
    module: "admin.team",
    action: "delete",
    description: "Menghapus team",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.team.manage_member",
    module: "admin.team",
    action: "manage_member",
    description: "Menambahkan dan menghapus anggota team",
    allowedScopes: [AccessScope.ALL],
  },
]);
