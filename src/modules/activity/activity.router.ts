// activity.router.ts

import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { ActivityController } from "./activity.controller";
import { CreateActivityDTO } from "./dto/create-activity.dto";
import { QueryActivityDTO } from "./dto/query-activity.dto";
import { UpdateActivityDTO } from "./dto/update-activity.dto";

@injectable()
export class ActivityRouter {
  private readonly router: Router = Router();

  constructor(private readonly activityController: ActivityController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("crm.activity.read"),
      validateQuery(QueryActivityDTO),
      this.activityController.getAllActivities,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("crm.activity.read"),
      this.activityController.getActivityById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("crm.activity.create"),
      validateBody(CreateActivityDTO),
      this.activityController.createActivity,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("crm.activity.update"),
      validateBody(UpdateActivityDTO),
      this.activityController.updateActivity,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("crm.activity.delete"),
      this.activityController.deleteActivity,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
