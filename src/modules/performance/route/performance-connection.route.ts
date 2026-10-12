import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { PerformanceConnectionController } from "../controller/performance-connection.controller";
import {
  CreatePerformanceConnectionDTO,
  QueryPerformanceConnectionDTO,
  UpdatePerformanceConnectionDTO,
} from "../dto/performance-connection.dto";

@injectable()
export class PerformanceConnectionRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceConnectionController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/connections",
      requirePermissions("performance.connection.read"),
      validateQuery(QueryPerformanceConnectionDTO),
      this.controller.getAll,
    );

    this.router.get(
      "/connections/:id",
      requirePermissions("performance.connection.read"),
      this.controller.getById,
    );

    this.router.post(
      "/connections",
      requirePermissions("performance.connection.create"),
      validateBody(CreatePerformanceConnectionDTO),
      this.controller.create,
    );

    this.router.patch(
      "/connections/:id",
      requirePermissions("performance.connection.update"),
      validateBody(UpdatePerformanceConnectionDTO),
      this.controller.update,
    );

    this.router.post(
      "/connections/:id/disable",
      requirePermissions("performance.connection.update"),
      this.controller.disable,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
