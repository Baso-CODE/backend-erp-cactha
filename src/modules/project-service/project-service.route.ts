import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateProjectServiceDTO } from "./dto/create-project-service.dto";
import { QueryProjectServiceDTO } from "./dto/query-project-service.dto";
import { UpdateProjectServiceDTO } from "./dto/update-project-service.dto";
import { ProjectServiceController } from "./project-service.controller";

@injectable()
export class ProjectServiceRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly projectServiceController: ProjectServiceController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("project.service.read"),
      validateQuery(QueryProjectServiceDTO),
      this.projectServiceController.getProjectServices,
    );

    this.router.get(
      "/:id",
      requirePermissions("project.service.read"),
      this.projectServiceController.getProjectServiceById,
    );

    this.router.post(
      "/",
      requirePermissions("project.service.create"),
      validateBody(CreateProjectServiceDTO),
      this.projectServiceController.createProjectService,
    );

    this.router.patch(
      "/:id",
      requirePermissions("project.service.update"),
      validateBody(UpdateProjectServiceDTO),
      this.projectServiceController.updateProjectService,
    );

    this.router.delete(
      "/:id",
      requirePermissions("project.service.delete"),
      this.projectServiceController.deleteProjectService,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
