import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "admin.team.read",
    module: "admin.team",
    action: "read",
    description: "Melihat daftar dan detail team",
  },
  {
    code: "admin.team.create",
    module: "admin.team",
    action: "create",
    description: "Membuat team baru",
  },
  {
    code: "admin.team.update",
    module: "admin.team",
    action: "update",
    description: "Memperbarui data team",
  },
  {
    code: "admin.team.delete",
    module: "admin.team",
    action: "delete",
    description: "Menghapus team",
  },
  {
    code: "admin.team.manage_member",
    module: "admin.team",
    action: "manage_member",
    description: "Menambahkan dan menghapus anggota team",
  },
]);
