import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";

import { DeliverableController } from "./deliverable.controller";

@injectable()
export class DeliverableRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: DeliverableController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("project.read"),
      this.controller.getAll,
    );

    this.router.post(
      "/",
      requirePermissions("project.update"),
      this.controller.create,
    );
    this.router.patch(
      "/:id",
      requirePermissions("project.update"),
      this.controller.update,
    );

    this.router.post(
      "/:id/submit",
      requirePermissions("project.update"),
      this.controller.submit,
    );

    this.router.patch(
      "/:id/start-review",
      requirePermissions("project.update"),
      this.controller.startReview,
    );

    this.router.patch(
      "/:id/ready",
      requirePermissions("project.update"),
      this.controller.markReady,
    );

    this.router.patch(
      "/:id/reopen",
      requirePermissions("project.update"),
      this.controller.reopenDraft,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
