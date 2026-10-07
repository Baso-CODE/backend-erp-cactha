import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "project.read",
    module: "project",
    action: "read",
    description: "Melihat project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.create",
    module: "project",
    action: "create",
    description: "Membuat project",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "project.update",
    module: "project",
    action: "update",
    description: "Mengubah project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.delete",
    module: "project",
    action: "delete",
    description: "Menghapus project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.assign",
    module: "project",
    action: "assign",
    description: "Mengubah project manager",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "project.service.read",
    module: "project.service",
    action: "read",
    description: "Melihat service dalam project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.service.create",
    module: "project.service",
    action: "create",
    description: "Menambahkan service ke project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.service.update",
    module: "project.service",
    action: "update",
    description: "Mengubah service dalam project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
  {
    code: "project.service.delete",
    module: "project.service",
    action: "delete",
    description: "Menghapus service dari project",
    allowedScopes: [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.ALL,
    ],
  },
]);
