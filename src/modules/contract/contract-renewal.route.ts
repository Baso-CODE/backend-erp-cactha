import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { ContractRenewalController } from "./contract-renewal.controller";

@injectable()
export class ContractRenewalRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: ContractRenewalController) {
    this.router.get(
      "/renewals/overview",
      authenticateToken,
      requirePermissions("contract.read"),
      this.controller.getOverview,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
