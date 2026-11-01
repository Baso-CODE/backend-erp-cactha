import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { ContractRenewalWorkflowController } from "./contract-renewal-workflow.controller";
import { CreateContractRenewalDTO } from "./dto/contract-renewal.dto";

@injectable()
export class ContractRenewalWorkflowRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: ContractRenewalWorkflowController) {
    this.router.use(authenticateToken);

    this.router.post(
      "/:id/renewals",
      requirePermissions("contract.create"),
      validateBody(CreateContractRenewalDTO),
      this.controller.createDraft,
    );

    this.router.patch(
      "/:id/renewals/activate",
      requirePermissions("contract.update"),
      this.controller.activateRenewal,
    );

    this.router.get(
      "/:id/renewals",
      requirePermissions("contract.read"),
      this.controller.getHistory,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
