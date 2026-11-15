import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";

import { CreateSupportReplyDTO } from "./dto/create-support-reply.dto";
import { QuerySupportTicketDTO } from "./dto/query-support-ticket.dto";
import { UpdateSupportTicketDTO } from "./dto/update-support-ticket.dto";
import { SupportTicketController } from "./support-ticket.controller";

@injectable()
export class SupportTicketRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: SupportTicketController) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("client.read"),
      validateQuery(QuerySupportTicketDTO),
      this.controller.getAll,
    );

    this.router.get(
      "/:id",
      requirePermissions("client.read"),
      this.controller.getById,
    );

    this.router.patch(
      "/:id",
      requirePermissions("client.update"),
      validateBody(UpdateSupportTicketDTO),
      this.controller.update,
    );

    this.router.post(
      "/:id/messages",
      requirePermissions("client.update"),
      validateBody(CreateSupportReplyDTO),
      this.controller.reply,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
