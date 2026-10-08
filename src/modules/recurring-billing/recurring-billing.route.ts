import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import {
  CreateRecurringBillingDTO,
  QueryRecurringBillingDTO,
  UpdateRecurringBillingDTO,
} from "./dto/recurring-billing.dto";
import { RecurringBillingController } from "./recurring-billing.controller";

@injectable()
export class RecurringBillingRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: RecurringBillingController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("recurring_billing.read"),
      validateQuery(QueryRecurringBillingDTO),
      this.controller.getAll,
    );

    this.router.post(
      "/:id/generate",
      authenticateToken,
      requirePermissions("recurring_billing.update"),
      requirePermissions("invoice.create"),
      this.controller.generateInvoice,
    );

    this.router.get(
      "/jobs/summary",
      authenticateToken,
      requirePermissions("recurring_billing.read"),
      this.controller.getJobSummary,
    );

    this.router.get(
      "/jobs",
      authenticateToken,
      requirePermissions("recurring_billing.read"),
      this.controller.getJobs,
    );

    this.router.post(
      "/jobs/:jobId/retry",
      authenticateToken,
      requirePermissions("recurring_billing.update"),
      requirePermissions("invoice.create"),
      this.controller.retryJob,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("recurring_billing.read"),
      this.controller.getById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("recurring_billing.create"),
      validateBody(CreateRecurringBillingDTO),
      this.controller.create,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("recurring_billing.update"),
      validateBody(UpdateRecurringBillingDTO),
      this.controller.update,
    );

    this.router.patch(
      "/:id/activate",
      authenticateToken,
      requirePermissions("recurring_billing.update"),
      this.controller.activate,
    );

    this.router.patch(
      "/:id/deactivate",
      authenticateToken,
      requirePermissions("recurring_billing.update"),
      this.controller.deactivate,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
