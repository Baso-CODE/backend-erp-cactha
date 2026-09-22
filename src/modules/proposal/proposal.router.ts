// proposal.router.ts

import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateProposalDTO } from "./dto/create-proposal.dto";
import { QueryProposalDTO } from "./dto/query-proposal.dto";
import { UpdateProposalDTO } from "./dto/update-proposal.dto";
import { ProposalController } from "./proposal.controller";

@injectable()
export class ProposalRouter {
  private readonly router: Router = Router();

  constructor(private readonly proposalController: ProposalController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("crm.proposal.read"),
      validateQuery(QueryProposalDTO),
      this.proposalController.getAllProposals,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("crm.proposal.read"),
      this.proposalController.getProposalById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("crm.proposal.create"),
      validateBody(CreateProposalDTO),
      this.proposalController.createProposal,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("crm.proposal.update"),
      validateBody(UpdateProposalDTO),
      this.proposalController.updateProposal,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("crm.proposal.delete"),
      this.proposalController.deleteProposal,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
