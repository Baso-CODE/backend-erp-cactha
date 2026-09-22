import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateLeadDTO } from "./dto/create-lead.dto";
import { QueryLeadDTO } from "./dto/query-lead.dto";
import { UpdateLeadDTO } from "./dto/update-lead.dto";
import { LeadController } from "./lead.controller";

@injectable()
export class LeadRouter {
  private readonly router: Router = Router();

  constructor(private readonly leadController: LeadController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("crm.lead.read"),
      validateQuery(QueryLeadDTO),
      this.leadController.getAllLeads,
    );

    this.router.get(
      "/metrics",
      authenticateToken,
      requirePermissions("crm.lead.read"),
      this.leadController.getLeadMetrics,
    );
    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("crm.lead.read"),
      this.leadController.getLeadById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("crm.lead.create"),
      validateBody(CreateLeadDTO),
      this.leadController.createLead,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("crm.lead.update"),
      validateBody(UpdateLeadDTO),
      this.leadController.updateLead,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("crm.lead.delete"),
      this.leadController.deleteLead,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
