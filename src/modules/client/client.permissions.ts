import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "client.read",
    module: "client",
    action: "read",
    description: "Melihat data client",
  },
  {
    code: "client.create",
    module: "client",
    action: "create",
    description: "Membuat client",
  },
  {
    code: "client.update",
    module: "client",
    action: "update",
    description: "Mengubah client",
  },
  {
    code: "client.delete",
    module: "client",
    action: "delete",
    description: "Menghapus client",
  },
  {
    code: "client.assign",
    module: "client",
    action: "assign",
    description: "Assign account manager ke client",
  },
  {
    code: "client.contact.read",
    module: "client.contact",
    action: "read",
    description: "Melihat contact person client",
  },
  {
    code: "client.contact.create",
    module: "client.contact",
    action: "create",
    description: "Membuat contact person client",
  },
  {
    code: "client.contact.update",
    module: "client.contact",
    action: "update",
    description: "Mengubah contact person client",
  },
  {
    code: "client.contact.delete",
    module: "client.contact",
    action: "delete",
    description: "Menghapus contact person client",
  },
]);
