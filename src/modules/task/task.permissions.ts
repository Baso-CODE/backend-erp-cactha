import { definePermissions } from "../rbac/dto/permission-registry.types";

export const permissions = definePermissions([
  {
    code: "task.read",
    module: "task",
    action: "read",
    description: "Melihat task",
  },
  {
    code: "task.create",
    module: "task",
    action: "create",
    description: "Membuat task",
  },
  {
    code: "task.update",
    module: "task",
    action: "update",
    description: "Mengubah task",
  },
  {
    code: "task.delete",
    module: "task",
    action: "delete",
    description: "Menghapus task",
  },
  {
    code: "task.assign",
    module: "task",
    action: "assign",
    description: "Assign task ke user",
  },
  {
    code: "task.manage",
    module: "task",
    action: "manage",
    description: "Mengelola status, posisi, dan workflow task",
  },
  {
    code: "task.checklist.create",
    module: "task.checklist",
    action: "create",
    description: "Membuat checklist task",
  },
  {
    code: "task.checklist.update",
    module: "task.checklist",
    action: "update",
    description: "Mengubah checklist task",
  },
  {
    code: "task.checklist.delete",
    module: "task.checklist",
    action: "delete",
    description: "Menghapus checklist task",
  },
  {
    code: "task.comment.create",
    module: "task.comment",
    action: "create",
    description: "Membuat komentar task",
  },
  {
    code: "task.comment.update",
    module: "task.comment",
    action: "update",
    description: "Mengubah komentar task",
  },
  {
    code: "task.comment.delete",
    module: "task.comment",
    action: "delete",
    description: "Menghapus komentar task",
  },
  {
    code: "task.attachment.create",
    module: "task.attachment",
    action: "create",
    description: "Menambahkan attachment ke task",
  },
  {
    code: "task.attachment.delete",
    module: "task.attachment",
    action: "delete",
    description: "Menghapus attachment task",
  },
]);
