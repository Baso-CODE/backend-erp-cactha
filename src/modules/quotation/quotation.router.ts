import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateQuotationDTO } from "./dto/create-quotation.dto";
import { QueryQuotationDTO } from "./dto/query-quotation.dto";
import { UpdateQuotationDTO } from "./dto/update-quotation.dto";
import { QuotationController } from "./quotation.controller";

@injectable()
export class QuotationRouter {
  private readonly router: Router = Router();

  constructor(private readonly quotationController: QuotationController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("crm.quotation.read"),
      validateQuery(QueryQuotationDTO),
      this.quotationController.getAllQuotations,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("crm.quotation.read"),
      this.quotationController.getQuotationById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("crm.quotation.create"),
      validateBody(CreateQuotationDTO),
      this.quotationController.createQuotation,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("crm.quotation.update"),
      validateBody(UpdateQuotationDTO),
      this.quotationController.updateQuotation,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("crm.quotation.delete"),
      this.quotationController.deleteQuotation,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
