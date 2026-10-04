import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateWorkflowTemplateDTO } from "./dto/create-workflow-template.dto";
import { QueryWorkflowTemplateDTO } from "./dto/query-workflow-template.dto";
import { UpdateWorkflowTemplateDTO } from "./dto/update-workflow-template.dto";
import { WorkflowTemplateController } from "./workflow-template.controller";

@injectable()
export class WorkflowTemplateRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly workflowTemplateController: WorkflowTemplateController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("workflow.template.read"),
      validateQuery(QueryWorkflowTemplateDTO),
      this.workflowTemplateController.getWorkflowTemplates,
    );

    this.router.get(
      "/:id",
      requirePermissions("workflow.template.read"),
      this.workflowTemplateController.getWorkflowTemplateById,
    );

    this.router.post(
      "/",
      requirePermissions("workflow.template.create"),
      validateBody(CreateWorkflowTemplateDTO),
      this.workflowTemplateController.createWorkflowTemplate,
    );

    this.router.patch(
      "/:id",
      requirePermissions("workflow.template.update"),
      validateBody(UpdateWorkflowTemplateDTO),
      this.workflowTemplateController.updateWorkflowTemplate,
    );

    this.router.delete(
      "/:id",
      requirePermissions("workflow.template.delete"),
      this.workflowTemplateController.deleteWorkflowTemplate,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
