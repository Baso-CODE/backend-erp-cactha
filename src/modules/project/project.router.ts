import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateProjectDTO } from "./dto/create-project.dto";
import { QueryProjectDTO } from "./dto/query-project.dto";
import { UpdateProjectDTO } from "./dto/update-project.dto";
import { ProjectController } from "./project.controller";

@injectable()
export class ProjectRouter {
  private readonly router: Router = Router();

  constructor(private readonly projectController: ProjectController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("project.read"),
      validateQuery(QueryProjectDTO),
      this.projectController.getProjects,
    );

    this.router.get(
      "/:id",
      requirePermissions("project.read"),
      this.projectController.getProjectById,
    );

    this.router.post(
      "/",
      requirePermissions("project.create"),
      validateBody(CreateProjectDTO),
      this.projectController.createProject,
    );

    this.router.patch(
      "/:id",
      requirePermissions("project.update"),
      validateBody(UpdateProjectDTO),
      this.projectController.updateProject,
    );

    this.router.delete(
      "/:id",
      requirePermissions("project.delete"),
      this.projectController.deleteProject,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
