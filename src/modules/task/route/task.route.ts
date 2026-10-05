import { Router } from "express";
import { inject, injectable } from "tsyringe";

import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { TaskController } from "../controller/task.controller";
import { CreateTaskDTO } from "../dto/create-task.dto";
import { MoveTaskDTO } from "../dto/move-task.dto";
import { QueryTaskDTO } from "../dto/query-task.dto";
import { UpdateTaskDTO } from "../dto/update-task.dto";

@injectable()
export class TaskRoute {
  public readonly router = Router();

  constructor(
    @inject(TaskController)
    private readonly taskController: TaskController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("task.read"),
      validateQuery(QueryTaskDTO),
      this.taskController.getAll,
    );

    this.router.get(
      "/:id/activity",
      requirePermissions("task.read"),
      this.taskController.getActivity,
    );

    this.router.get(
      "/:id",
      requirePermissions("task.read"),
      this.taskController.getById,
    );

    this.router.post(
      "/",
      requirePermissions("task.create"),
      validateBody(CreateTaskDTO),
      this.taskController.create,
    );

    this.router.patch(
      "/:id",
      requirePermissions("task.update"),
      validateBody(UpdateTaskDTO),
      this.taskController.update,
    );

    this.router.patch(
      "/:id/move",
      requirePermissions("task.manage"),
      validateBody(MoveTaskDTO),
      this.taskController.move,
    );

    this.router.delete(
      "/:id",
      requirePermissions("task.delete"),
      this.taskController.delete,
    );
  }
}
