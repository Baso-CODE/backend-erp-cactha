import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { ContractController } from "./contract.controller";
import { CreateContractDTO } from "./dto/create-contract.dto";
import { QueryContractDTO } from "./dto/query-contract.dto";
import { UpdateContractDTO } from "./dto/update-contract.dto";

@injectable()
export class ContractRouter {
  private readonly router: Router = Router();

  constructor(private readonly contractController: ContractController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("contract.read"),
      validateQuery(QueryContractDTO),
      this.contractController.getAllContracts,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("contract.read"),
      this.contractController.getContractById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("contract.create"),
      validateBody(CreateContractDTO),
      this.contractController.createContract,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("contract.update"),
      validateBody(UpdateContractDTO),
      this.contractController.updateContract,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("contract.delete"),
      this.contractController.deleteContract,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
