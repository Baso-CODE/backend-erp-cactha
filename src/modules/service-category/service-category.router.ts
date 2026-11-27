import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";

import { CreateServiceCategoryDTO } from "./dto/create-service-category.dto";
import { UpdateServiceCategoryDTO } from "./dto/update-service-category.dto";
import { ServiceCategoryController } from "./service-category.controller";

@injectable()
export class ServiceCategoryRouter {
  private readonly router = Router();

  constructor(private readonly controller: ServiceCategoryController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("master.service.read"),
      this.controller.getAll,
    );

    this.router.get(
      "/:id",
      requirePermissions("master.service.read"),
      this.controller.getById,
    );

    this.router.post(
      "/",
      requirePermissions("master.service.create"),
      validateBody(CreateServiceCategoryDTO),
      this.controller.create,
    );

    this.router.patch(
      "/:id",
      requirePermissions("master.service.update"),
      validateBody(UpdateServiceCategoryDTO),
      this.controller.update,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
