import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceTikTokOAuthController } from "../controller/performance-tiktok-oauth.controller";

@injectable()
export class PerformanceTikTokOAuthRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceTikTokOAuthController) {
    this.router.get("/oauth/tiktok/callback", this.controller.callback);

    this.router.get(
      "/oauth/tiktok/:connectionId/start",
      authenticateToken,
      requirePermissions("performance.connection.update"),
      this.controller.start,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
