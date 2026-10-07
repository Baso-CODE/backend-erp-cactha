import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreatePaymentDTO } from "./dto/create-payment.dto";
import { QueryPaymentDTO } from "./dto/query-payment.dto";
import { RejectPaymentDTO } from "./dto/reject-payment.dto";
import { UpdatePaymentDTO } from "./dto/update-payment.dto";
import { PaymentController } from "./payment.controller";

@injectable()
export class PaymentRouter {
  private readonly router: Router = Router();

  constructor(private readonly paymentController: PaymentController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("payment.read"),
      validateQuery(QueryPaymentDTO),
      this.paymentController.getAllPayments,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("payment.read"),
      this.paymentController.getPaymentById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("payment.create"),
      validateBody(CreatePaymentDTO),
      this.paymentController.createPayment,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("payment.update"),
      validateBody(UpdatePaymentDTO),
      this.paymentController.updatePayment,
    );

    this.router.post(
      "/:id/verify",
      authenticateToken,
      requirePermissions("payment.verify"),
      this.paymentController.verifyPayment,
    );

    this.router.post(
      "/:id/reject",
      authenticateToken,
      requirePermissions("payment.reject"),
      validateBody(RejectPaymentDTO),
      this.paymentController.rejectPayment,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
