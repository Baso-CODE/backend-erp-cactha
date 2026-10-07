import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "project.read",
    module: "project",
    action: "read",
    description: "Melihat project",
  },
  {
    code: "project.create",
    module: "project",
    action: "create",
    description: "Membuat project",
  },
  {
    code: "project.update",
    module: "project",
    action: "update",
    description: "Mengubah project",
  },
  {
    code: "project.delete",
    module: "project",
    action: "delete",
    description: "Menghapus project",
  },
  {
    code: "project.assign",
    module: "project",
    action: "assign",
    description: "Mengubah project manager",
  },
  {
    code: "project.service.read",
    module: "project.service",
    action: "read",
    description: "Melihat service dalam project",
  },
  {
    code: "project.service.create",
    module: "project.service",
    action: "create",
    description: "Menambahkan service ke project",
  },
  {
    code: "project.service.update",
    module: "project.service",
    action: "update",
    description: "Mengubah service dalam project",
  },
  {
    code: "project.service.delete",
    module: "project.service",
    action: "delete",
    description: "Menghapus service dari project",
  },
]);
