import { Router } from "express";
import { inject, injectable } from "tsyringe";
import { taskAttachmentUpload } from "../../../common/task-attachment-upload.middleware";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { TaskAttachmentController } from "../controller/task-attachment.controller";

@injectable()
export class TaskAttachmentRoute {
  public readonly router = Router();

  constructor(
    @inject(TaskAttachmentController)
    private readonly controller: TaskAttachmentController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(
      "/tasks/:taskId/attachments",
      authenticateToken,
      requirePermissions("task.read"),
      this.controller.getAll,
    );

    this.router.post(
      "/tasks/:taskId/attachments",
      authenticateToken,
      requirePermissions("task.attachment.create"),
      taskAttachmentUpload.single("file"),
      this.controller.create,
    );

    this.router.delete(
      "/task-attachments/:id",
      authenticateToken,
      requirePermissions("task.attachment.delete"),
      this.controller.delete,
    );
  }
}
