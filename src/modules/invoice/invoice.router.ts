import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateInvoiceDTO } from "./dto/create-invoice.dto";
import { QueryInvoiceDTO } from "./dto/query-invoice.dto";
import { UpdateInvoiceDTO } from "./dto/update-invoice.dto";
import { InvoiceController } from "./invoice.controller";

@injectable()
export class InvoiceRouter {
  private readonly router: Router = Router();

  constructor(private readonly invoiceController: InvoiceController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("invoice.read"),
      validateQuery(QueryInvoiceDTO),
      this.invoiceController.getAllInvoices,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("invoice.read"),
      this.invoiceController.getInvoiceById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("invoice.create"),
      validateBody(CreateInvoiceDTO),
      this.invoiceController.createInvoice,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("invoice.update"),
      validateBody(UpdateInvoiceDTO),
      this.invoiceController.updateInvoice,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("invoice.delete"),
      this.invoiceController.deleteInvoice,
    );

    this.router.post(
      "/:id/send",
      authenticateToken,
      requirePermissions("invoice.update"),
      this.invoiceController.sendInvoice,
    );

    this.router.post(
      "/:id/cancel",
      authenticateToken,
      requirePermissions("invoice.update"),
      this.invoiceController.cancelInvoice,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
