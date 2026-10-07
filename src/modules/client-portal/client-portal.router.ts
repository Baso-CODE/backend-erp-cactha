import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";

import { ClientApprovalController } from "./controller/client-approval.controller";
import { ClientContextController } from "./controller/client-context.controller";
import { ClientDashboardController } from "./controller/client-dashboard.controller";
import { ClientDocumentController } from "./controller/client-document.controller";
import { ClientProfileController } from "./controller/client-profile.controller";
import { ClientProjectController } from "./controller/client-project.controller";
import { ClientServiceController } from "./controller/client-service.controller";
import { ClientSupportController } from "./controller/client-support.controller";
import { CreateClientSupportMessageDTO } from "./dto/create-client-support-message.dto";
import { CreateClientSupportDTO } from "./dto/create-client-support.dto";
import { QueryClientDocumentDTO } from "./dto/query-client-document.dto";
import { QueryClientProjectDTO } from "./dto/query-client-project.dto";
import { QueryClientServiceDTO } from "./dto/query-client-service.dto";
import { QueryClientSupportDTO } from "./dto/query-client-support.dto";
import { RequestClientRevisionDTO } from "./dto/request-client-revision.dto";

@injectable()
export class ClientPortalRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly clientContextController: ClientContextController,
    private readonly clientDashboardController: ClientDashboardController,
    private readonly clientProjectController: ClientProjectController,
    private readonly clientApprovalController: ClientApprovalController,
    private readonly clientSupportController: ClientSupportController,
    private readonly clientServiceController: ClientServiceController,
    private readonly clientDocumentController: ClientDocumentController,
    private readonly clientProfileController: ClientProfileController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/context",
      authenticateToken,
      this.clientContextController.getContext,
    );

    this.router.get(
      "/profile",
      authenticateToken,
      this.clientProfileController.getProfile,
    );
    this.router.get(
      "/dashboard",
      authenticateToken,
      this.clientDashboardController.getDashboard,
    );

    this.router.get(
      "/projects",
      authenticateToken,
      validateQuery(QueryClientProjectDTO),
      this.clientProjectController.getProjects,
    );

    this.router.get(
      "/projects/:id",
      authenticateToken,
      this.clientProjectController.getProjectById,
    );

    this.router.get(
      "/services",
      authenticateToken,
      validateQuery(QueryClientServiceDTO),
      this.clientServiceController.getServices,
    );

    this.router.get(
      "/documents",
      authenticateToken,
      validateQuery(QueryClientDocumentDTO),
      this.clientDocumentController.getDocuments,
    );

    this.router.get(
      "/approvals",
      authenticateToken,
      this.clientApprovalController.getApprovals,
    );

    this.router.post(
      "/approvals/:id/approve",
      authenticateToken,
      this.clientApprovalController.approve,
    );

    this.router.post(
      "/approvals/:id/request-revision",
      authenticateToken,
      validateBody(RequestClientRevisionDTO),
      this.clientApprovalController.requestRevision,
    );

    this.router.get(
      "/support",
      authenticateToken,
      validateQuery(QueryClientSupportDTO),
      this.clientSupportController.getTickets,
    );

    this.router.post(
      "/support",
      authenticateToken,
      validateBody(CreateClientSupportDTO),
      this.clientSupportController.createTicket,
    );

    this.router.get(
      "/support/:id",
      authenticateToken,
      this.clientSupportController.getTicketById,
    );

    this.router.post(
      "/support/:id/messages",
      authenticateToken,
      validateBody(CreateClientSupportMessageDTO),
      this.clientSupportController.createMessage,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
