import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { PerformanceDataController } from "../controller/performance-data.controller";
import { QueryPerformanceDataDTO } from "../dto/performance-data.dto";

@injectable()
export class PerformanceDataRouter {
  private readonly router: Router = Router();
  constructor(private readonly controller: PerformanceDataController) {
    this.router.get("/data", authenticateToken, requirePermissions("performance.data.read"), validateQuery(QueryPerformanceDataDTO), this.controller.getAll);
  }
  getRouter(): Router { return this.router; }
}
