import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { ClientPortalUserController } from "../client-portal/controller/client-portal-user.controller";
import { ContactPersonController } from "./contact-person.controller";
import { CreateContactPersonDTO } from "./dto/create-contact-person.dto";
import { QueryContactPersonDTO } from "./dto/query-contact-person.dto";
import { UpdateContactPersonDTO } from "./dto/update-contact-person.dto";

@injectable()
export class ContactPersonRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly contactPersonController: ContactPersonController,
    private readonly clientPortalUserController: ClientPortalUserController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/",
      authenticateToken,
      requirePermissions("client.contact.read"),
      validateQuery(QueryContactPersonDTO),
      this.contactPersonController.getAllContactPersons,
    );

    this.router.get(
      "/contact-persons/portal-users/options",
      authenticateToken,
      requirePermissions("client.contact.update"),
      this.clientPortalUserController.getOptions,
    );
    this.router.get(
      "/:id",
      authenticateToken,
      requirePermissions("client.contact.read"),
      this.contactPersonController.getContactPersonById,
    );

    this.router.post(
      "/",
      authenticateToken,
      requirePermissions("client.contact.create"),
      validateBody(CreateContactPersonDTO),
      this.contactPersonController.createContactPerson,
    );

    this.router.patch(
      "/:id",
      authenticateToken,
      requirePermissions("client.contact.update"),
      validateBody(UpdateContactPersonDTO),
      this.contactPersonController.updateContactPerson,
    );

    this.router.delete(
      "/:id",
      authenticateToken,
      requirePermissions("client.contact.delete"),
      this.contactPersonController.deleteContactPerson,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
