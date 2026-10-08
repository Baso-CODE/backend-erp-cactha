import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import {
  CreateProjectBudgetDTO,
  QueryProjectBudgetDTO,
  UpdateProjectBudgetDTO,
} from "./dto/project-budget.dto";
import {
  CreateProjectCostDTO,
  QueryProjectCostDTO,
  UpdateProjectCostDTO,
} from "./dto/project-cost.dto";
import { QueryProjectProfitabilityDTO } from "./dto/query-project-profitability.dto";
import { SaveRevenueAllocationsDTO } from "./dto/revenue-allocation.dto";
import { ProfitabilityController } from "./profitability.controller";

@injectable()
export class ProfitabilityRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: ProfitabilityController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticateToken);

    // Project Profitability
    this.router.get(
      "/projects",
      requirePermissions("profitability.read"),
      validateQuery(QueryProjectProfitabilityDTO),
      this.controller.getProjectsProfitability,
    );

    this.router.get(
      "/projects/:projectId/services",
      requirePermissions("profitability.read"),
      this.controller.getProjectServiceProfitability,
    );

    this.router.get(
      "/projects/:projectId",
      requirePermissions("profitability.read"),
      this.controller.getProjectProfitability,
    );

    // Project Budget
    this.router.get(
      "/budgets",
      requirePermissions("profitability.read"),
      validateQuery(QueryProjectBudgetDTO),
      this.controller.getBudgets,
    );

    this.router.get(
      "/budgets/:id",
      requirePermissions("profitability.read"),
      this.controller.getBudgetById,
    );

    this.router.post(
      "/budgets",
      requirePermissions("profitability.create"),
      validateBody(CreateProjectBudgetDTO),
      this.controller.createBudget,
    );

    this.router.patch(
      "/budgets/:id",
      requirePermissions("profitability.update"),
      validateBody(UpdateProjectBudgetDTO),
      this.controller.updateBudget,
    );

    this.router.delete(
      "/budgets/:id",
      requirePermissions("profitability.delete"),
      this.controller.deleteBudget,
    );

    // Project Actual Cost
    this.router.get(
      "/costs",
      requirePermissions("profitability.read"),
      validateQuery(QueryProjectCostDTO),
      this.controller.getCosts,
    );

    this.router.get(
      "/costs/:id",
      requirePermissions("profitability.read"),
      this.controller.getCostById,
    );

    this.router.post(
      "/costs",
      requirePermissions("profitability.create"),
      validateBody(CreateProjectCostDTO),
      this.controller.createCost,
    );

    this.router.patch(
      "/costs/:id",
      requirePermissions("profitability.update"),
      validateBody(UpdateProjectCostDTO),
      this.controller.updateCost,
    );

    this.router.delete(
      "/costs/:id",
      requirePermissions("profitability.delete"),
      this.controller.deleteCost,
    );

    // Invoice Revenue Allocation
    this.router.get(
      "/invoices/:invoiceId/allocations",
      requirePermissions("profitability.read"),
      this.controller.getInvoiceAllocations,
    );

    this.router.put(
      "/invoices/:invoiceId/allocations",
      requirePermissions("profitability.update"),
      validateBody(SaveRevenueAllocationsDTO),
      this.controller.saveInvoiceAllocations,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
