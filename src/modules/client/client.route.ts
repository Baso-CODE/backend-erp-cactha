import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { ClientController } from "./client.controller";
import { CreateClientDTO } from "./dto/create-client.dto";
import { QueryClientDTO } from "./dto/query-client.dto";
import { UpdateClientDTO } from "./dto/update-client.dto";

@injectable()
export class ClientRouter {
  private readonly router: Router = Router();

  constructor(private readonly clientController: ClientController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("client.read"),
      validateQuery(QueryClientDTO),
      this.clientController.getAllClients,
    );

    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("client.read"),
      this.clientController.getClientById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("client.create"),
      validateBody(CreateClientDTO),
      this.clientController.createClient,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("client.update"),
      validateBody(UpdateClientDTO),
      this.clientController.updateClient,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("client.delete"),
      this.clientController.deleteClient,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
