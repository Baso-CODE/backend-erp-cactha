import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateQuery } from "../../../middleware/validateQuery.middleware";
import { ClientKpiController } from "../controller/client-kpi.controller";
import { QueryClientKpiDTO } from "../dto/query-client-kpi.dto";

@injectable()
export class ClientKpiRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: ClientKpiController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticateToken);

    this.router.get(
      "/clients/overview",
      requirePermissions("client.read"),
      validateQuery(QueryClientKpiDTO),
      this.controller.getOverview,
    );

    this.router.get(
      "/clients/ranking",
      requirePermissions("client.read"),
      validateQuery(QueryClientKpiDTO),
      this.controller.getRanking,
    );

    this.router.get(
      "/clients/financial",
      requirePermissions("client.read"),
      requirePermissions("invoice.read"),
      requirePermissions("payment.read"),
      validateQuery(QueryClientKpiDTO),
      this.controller.getFinancial,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
