import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const readScopes = [
  AccessScope.OWN,
  AccessScope.TEAM,
  AccessScope.PROJECT,
  AccessScope.ALL,
];

const manageScopes = [AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "performance.connection.read",
    module: "performance.connection",
    action: "read",
    description: "Melihat koneksi platform performance",
    allowedScopes: readScopes,
  },
  {
    code: "performance.connection.create",
    module: "performance.connection",
    action: "create",
    description: "Membuat koneksi platform performance",
    allowedScopes: manageScopes,
  },
  {
    code: "performance.connection.update",
    module: "performance.connection",
    action: "update",
    description: "Mengubah atau menonaktifkan koneksi",
    allowedScopes: manageScopes,
  },
  {
    code: "performance.mapping.read",
    module: "performance.mapping",
    action: "read",
    description: "Melihat mapping performance",
    allowedScopes: readScopes,
  },
  {
    code: "performance.mapping.create",
    module: "performance.mapping",
    action: "create",
    description: "Membuat mapping performance",
    allowedScopes: manageScopes,
  },
  {
    code: "performance.mapping.update",
    module: "performance.mapping",
    action: "update",
    description: "Mengubah mapping performance",
    allowedScopes: manageScopes,
  },
  {
    code: "performance.sync.read",
    module: "performance.sync",
    action: "read",
    description: "Melihat histori sinkronisasi",
    allowedScopes: readScopes,
  },
  {
    code: "performance.sync.execute",
    module: "performance.sync",
    action: "execute",
    description: "Menjalankan sinkronisasi performance",
    allowedScopes: manageScopes,
  },
  {
    code: "performance.data.read",
    module: "performance.data",
    action: "read",
    description: "Melihat data performance",
    allowedScopes: readScopes,
  },
]);
