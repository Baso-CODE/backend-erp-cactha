import { Router } from "express";
import { inject, injectable } from "tsyringe";

import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { TaskChecklistController } from "../controller/task-checklist.controller";
import { CreateTaskChecklistDTO } from "../dto/create-task-checklist.dto";
import { UpdateTaskChecklistDTO } from "../dto/update-task-checklist.dto";

@injectable()
export class TaskChecklistRoute {
  public readonly router = Router();

  constructor(
    @inject(TaskChecklistController)
    private readonly taskChecklistController: TaskChecklistController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.use(authenticateToken);

    this.router.get(
      "/tasks/:taskId/checklists",
      requirePermissions("task.read"),
      this.taskChecklistController.getAll,
    );

    this.router.post(
      "/tasks/:taskId/checklists",
      requirePermissions("task.checklist.create"),
      validateBody(CreateTaskChecklistDTO),
      this.taskChecklistController.create,
    );

    this.router.patch(
      "/task-checklists/:id",
      requirePermissions("task.checklist.update"),
      validateBody(UpdateTaskChecklistDTO),
      this.taskChecklistController.update,
    );

    this.router.delete(
      "/task-checklists/:id",
      requirePermissions("task.checklist.delete"),
      this.taskChecklistController.delete,
    );
  }
}
