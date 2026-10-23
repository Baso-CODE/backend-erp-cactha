import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceTikTokAccountController } from "../controller/performance-tiktok-account.controller";

@injectable()
export class PerformanceTikTokAccountRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceTikTokAccountController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/tiktok/connections/:id/accounts",
      requirePermissions("performance.connection.read"),
      this.controller.getAccounts,
    );

    this.router.post(
      "/tiktok/connections/:id/discover",
      requirePermissions("performance.connection.update"),
      this.controller.discover,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
