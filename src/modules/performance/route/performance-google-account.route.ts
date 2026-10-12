import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceGoogleAccountController } from "../controller/performance-google-account.controller";

@injectable()
export class PerformanceGoogleAccountRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceGoogleAccountController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/connections/:id/accounts",
      requirePermissions("performance.connection.read"),
      this.controller.getAccounts,
    );

    this.router.post(
      "/connections/:id/discover",
      requirePermissions("performance.connection.update"),
      this.controller.discover,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
