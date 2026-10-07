import { AccessScope } from "@prisma/client";
import { definePermissions } from "./dto/permission-registry.types";
export const permissions = definePermissions([
  {
    code: "admin.user.read",
    module: "admin.user",
    action: "read",
    description: "Melihat data user",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.user.create",
    module: "admin.user",
    action: "create",
    description: "Membuat user",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.user.update",
    module: "admin.user",
    action: "update",
    description: "Mengubah user",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.user.delete",
    module: "admin.user",
    action: "delete",
    description: "Menghapus user",
    allowedScopes: [AccessScope.ALL],
  },

  {
    code: "admin.role.read",
    module: "admin.role",
    action: "read",
    description: "Melihat role",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.role.create",
    module: "admin.role",
    action: "create",
    description: "Membuat role",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.role.update",
    module: "admin.role",
    action: "update",
    description: "Mengubah role",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.role.delete",
    module: "admin.role",
    action: "delete",
    description: "Menghapus role",
    allowedScopes: [AccessScope.ALL],
  },

  {
    code: "admin.permission.read",
    module: "admin.permission",
    action: "read",
    description: "Melihat permission",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "admin.permission.manage",
    module: "admin.permission",
    action: "manage",
    description: "Mengelola permission",
    allowedScopes: [AccessScope.ALL],
  },

  {
    code: "admin.audit.read",
    module: "admin.audit",
    action: "read",
    description: "Melihat audit log",
    allowedScopes: [AccessScope.ALL],
  },
]);
