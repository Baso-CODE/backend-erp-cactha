import { Router } from "express";
import { inject, injectable } from "tsyringe";

import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { TaskCommentController } from "../controller/task-comment.controller";
import { CreateTaskCommentDTO } from "../dto/create-task-comment.dto";
import { UpdateTaskCommentDTO } from "../dto/update-task-comment.dto";

@injectable()
export class TaskCommentRoute {
  public readonly router = Router();

  constructor(
    @inject(TaskCommentController)
    private readonly taskCommentController: TaskCommentController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticateToken);

    this.router.get(
      "/tasks/:taskId/comments",
      requirePermissions("task.read"),
      this.taskCommentController.getAll,
    );

    this.router.post(
      "/tasks/:taskId/comments",
      requirePermissions("task.comment.create"),
      validateBody(CreateTaskCommentDTO),
      this.taskCommentController.create,
    );

    this.router.patch(
      "/task-comments/:id",
      requirePermissions("task.comment.update"),
      validateBody(UpdateTaskCommentDTO),
      this.taskCommentController.update,
    );

    this.router.delete(
      "/task-comments/:id",
      requirePermissions("task.comment.delete"),
      this.taskCommentController.delete,
    );
  }
}
