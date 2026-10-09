import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { ProjectReportController } from "../controller/project-report.controller";
import { QueryProjectReportDTO } from "../dto/query-project-report.dto";

@injectable()
export class ProjectReportRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly projectReportController: ProjectReportController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      "/projects/overview",
      authenticateToken,
      requirePermissions("project.read"),
      validateQuery(QueryProjectReportDTO),
      this.projectReportController.getOverview,
    );

    this.router.get(
      "/projects/progress",
      authenticateToken,
      requirePermissions("project.read"),
      validateQuery(QueryProjectReportDTO),
      this.projectReportController.getProgress,
    );

    this.router.get(
      "/projects/timeline",
      authenticateToken,
      requirePermissions("project.read"),
      validateQuery(QueryProjectReportDTO),
      this.projectReportController.getTimeline,
    );

    this.router.get(
      "/projects/financial",
      authenticateToken,
      requirePermissions("project.read"),
      requirePermissions("profitability.read"),
      validateQuery(QueryProjectReportDTO),
      this.projectReportController.getFinancial,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
