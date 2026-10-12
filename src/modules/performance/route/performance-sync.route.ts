import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { PerformanceSyncController } from "../controller/performance-sync.controller";
import {
  ExecutePerformanceSyncDTO,
  QueryPerformanceSyncLogsDTO,
} from "../dto/performance-sync.dto";

@injectable()
export class PerformanceSyncRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceSyncController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticateToken);

    this.router.post(
      "/connections/:id/sync",
      requirePermissions("performance.sync.execute"),
      validateBody(ExecutePerformanceSyncDTO),
      this.controller.execute,
    );

    this.router.get(
      "/connections/:id/logs",
      requirePermissions("performance.sync.read"),
      validateQuery(QueryPerformanceSyncLogsDTO),
      this.controller.getLogs,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
