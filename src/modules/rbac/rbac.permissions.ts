import { definePermissions } from "./dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "admin.user.read",
    module: "admin.user",
    action: "read",
    description: "Melihat data user",
  },
  {
    code: "admin.user.create",
    module: "admin.user",
    action: "create",
    description: "Membuat user",
  },
  {
    code: "admin.user.update",
    module: "admin.user",
    action: "update",
    description: "Mengubah user",
  },
  {
    code: "admin.user.delete",
    module: "admin.user",
    action: "delete",
    description: "Menghapus user",
  },

  {
    code: "admin.role.read",
    module: "admin.role",
    action: "read",
    description: "Melihat role",
  },
  {
    code: "admin.role.create",
    module: "admin.role",
    action: "create",
    description: "Membuat role",
  },
  {
    code: "admin.role.update",
    module: "admin.role",
    action: "update",
    description: "Mengubah role",
  },
  {
    code: "admin.role.delete",
    module: "admin.role",
    action: "delete",
    description: "Menghapus role",
  },

  {
    code: "admin.permission.read",
    module: "admin.permission",
    action: "read",
    description: "Melihat permission",
  },
  {
    code: "admin.permission.manage",
    module: "admin.permission",
    action: "manage",
    description: "Mengelola permission",
  },

  {
    code: "admin.audit.read",
    module: "admin.audit",
    action: "read",
    description: "Melihat audit log",
  },
]);
