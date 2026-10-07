import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "client.read",
    module: "client",
    action: "read",
    description: "Melihat data client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.create",
    module: "client",
    action: "create",
    description: "Membuat client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.update",
    module: "client",
    action: "update",
    description: "Mengubah client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.delete",
    module: "client",
    action: "delete",
    description: "Menghapus client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.assign",
    module: "client",
    action: "assign",
    description: "Assign account manager ke client",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "client.contact.read",
    module: "client.contact",
    action: "read",
    description: "Melihat contact person client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.contact.create",
    module: "client.contact",
    action: "create",
    description: "Membuat contact person client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.contact.update",
    module: "client.contact",
    action: "update",
    description: "Mengubah contact person client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
  {
    code: "client.contact.delete",
    module: "client.contact",
    action: "delete",
    description: "Menghapus contact person client",
    allowedScopes: [AccessScope.OWN, AccessScope.TEAM, AccessScope.ALL],
  },
]);
