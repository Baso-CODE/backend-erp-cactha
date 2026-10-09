import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { TeamWorkloadController } from "../controller/team-workload.controller";
import {
  QueryTeamWorkloadDTO,
  QueryTeamWorkloadIssuesDTO,
} from "../dto/query-team-workload.dto";

@injectable()
export class TeamWorkloadRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: TeamWorkloadController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticateToken);

    this.router.get(
      "/team-workload/overview",
      requirePermissions("task.read"),
      validateQuery(QueryTeamWorkloadDTO),
      this.controller.getOverview,
    );

    this.router.get(
      "/team-workload/assignees",
      requirePermissions("task.read"),
      validateQuery(QueryTeamWorkloadDTO),
      this.controller.getAssignees,
    );

    this.router.get(
      "/team-workload/issues",
      requirePermissions("task.read"),
      validateQuery(QueryTeamWorkloadIssuesDTO),
      this.controller.getIssues,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
