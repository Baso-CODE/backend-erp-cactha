import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { PerformanceGoogleOAuthController } from "../controller/performance-google-oauth.controller";

@injectable()
export class PerformanceGoogleOAuthRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceGoogleOAuthController) {
    this.router.get("/oauth/google/callback", this.controller.callback);

    this.router.get(
      "/oauth/google/:connectionId/start",
      authenticateToken,
      requirePermissions("performance.connection.update"),
      this.controller.start,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
