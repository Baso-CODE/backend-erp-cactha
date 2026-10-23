import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceMetaAccountController } from "../controller/performance-meta-account.controller";

@injectable()
export class PerformanceMetaAccountRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceMetaAccountController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/meta/connections/:id/accounts",
      requirePermissions("performance.connection.read"),
      this.controller.getAccounts,
    );

    this.router.post(
      "/meta/connections/:id/discover",
      requirePermissions("performance.connection.update"),
      this.controller.discover,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
