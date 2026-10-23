import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceMetaOAuthController } from "../controller/performance-meta-oauth.controller";

@injectable()
export class PerformanceMetaOAuthRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceMetaOAuthController) {
    this.router.get("/oauth/meta/callback", this.controller.callback);

    this.router.get(
      "/oauth/meta/:connectionId/start",
      authenticateToken,
      requirePermissions("performance.connection.update"),
      this.controller.start,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
