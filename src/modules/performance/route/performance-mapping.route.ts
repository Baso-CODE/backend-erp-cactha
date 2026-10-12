import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../../middleware/auth.middleware";
import { requirePermissions } from "../../../middleware/permission.middleware";
import { validateBody } from "../../../middleware/validateBody.middleware";
import { PerformanceMappingController } from "../controller/performance-mapping.controller";
import {
  CreatePerformanceMappingDTO,
  UpdatePerformanceMappingDTO,
} from "../dto/performance-mapping.dto";

@injectable()
export class PerformanceMappingRouter {
  private readonly router: Router = Router();

  constructor(private readonly controller: PerformanceMappingController) {
    this.router.use(authenticateToken);

    this.router.get(
      "/mappings",
      requirePermissions("performance.mapping.read"),
      this.controller.getAll,
    );

    this.router.post(
      "/mappings",
      requirePermissions("performance.mapping.create"),
      validateBody(CreatePerformanceMappingDTO),
      this.controller.create,
    );

    this.router.patch(
      "/mappings/:id",
      requirePermissions("performance.mapping.update"),
      validateBody(UpdatePerformanceMappingDTO),
      this.controller.update,
    );
  }

  getRouter(): Router {
    return this.router;
  }
}
