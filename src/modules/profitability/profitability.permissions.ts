import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const scopes = [AccessScope.OWN, AccessScope.ALL];

export const permissions = definePermissions([
  {
    code: "profitability.read",
    module: "profitability",
    action: "read",
    description: "Melihat anggaran, biaya, dan profitabilitas proyek",
    allowedScopes: scopes,
  },
  {
    code: "profitability.create",
    module: "profitability",
    action: "create",
    description: "Membuat anggaran dan biaya proyek",
    allowedScopes: scopes,
  },
  {
    code: "profitability.update",
    module: "profitability",
    action: "update",
    description: "Mengubah anggaran dan biaya proyek",
    allowedScopes: scopes,
  },
  {
    code: "profitability.delete",
    module: "profitability",
    action: "delete",
    description: "Menghapus anggaran dan biaya proyek",
    allowedScopes: scopes,
  },
]);
