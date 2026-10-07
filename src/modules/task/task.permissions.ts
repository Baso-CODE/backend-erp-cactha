import { AccessScope } from "@prisma/client";
import { definePermissions } from "../rbac/dto/permission-registry.types";

const taskScopes = [
  AccessScope.OWN,
  AccessScope.TEAM,
  AccessScope.PROJECT,
  AccessScope.ALL,
];

export const permissions = definePermissions([
  {
    code: "task.read",
    module: "task",
    action: "read",
    description: "Melihat task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.create",
    module: "task",
    action: "create",
    description: "Membuat task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.update",
    module: "task",
    action: "update",
    description: "Mengubah task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.delete",
    module: "task",
    action: "delete",
    description: "Menghapus task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.assign",
    module: "task",
    action: "assign",
    description: "Assign task ke user",
    allowedScopes: taskScopes,
  },
  {
    code: "task.manage",
    module: "task",
    action: "manage",
    description: "Mengelola status, posisi, dan workflow task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.checklist.create",
    module: "task.checklist",
    action: "create",
    description: "Membuat checklist task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.checklist.update",
    module: "task.checklist",
    action: "update",
    description: "Mengubah checklist task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.checklist.delete",
    module: "task.checklist",
    action: "delete",
    description: "Menghapus checklist task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.comment.create",
    module: "task.comment",
    action: "create",
    description: "Membuat komentar task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.comment.update",
    module: "task.comment",
    action: "update",
    description: "Mengubah komentar task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.comment.delete",
    module: "task.comment",
    action: "delete",
    description: "Menghapus komentar task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.attachment.create",
    module: "task.attachment",
    action: "create",
    description: "Menambahkan attachment ke task",
    allowedScopes: taskScopes,
  },
  {
    code: "task.attachment.delete",
    module: "task.attachment",
    action: "delete",
    description: "Menghapus attachment task",
    allowedScopes: taskScopes,
  },
]);
