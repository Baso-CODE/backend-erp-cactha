import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "workflow.template.read",
    module: "workflow.template",
    action: "read",
    description: "Melihat workflow template",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "workflow.template.create",
    module: "workflow.template",
    action: "create",
    description: "Membuat workflow template",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "workflow.template.update",
    module: "workflow.template",
    action: "update",
    description: "Mengubah workflow template",
    allowedScopes: [AccessScope.ALL],
  },
  {
    code: "workflow.template.delete",
    module: "workflow.template",
    action: "delete",
    description: "Menghapus workflow template",
    allowedScopes: [AccessScope.ALL],
  },
]);
