import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateMasterServiceDTO } from "./dto/create-master-service.dto";
import { QueryMasterServiceDTO } from "./dto/query-master-service.dto";
import { UpdateMasterServiceDTO } from "./dto/update-master-service.dto";
import { MasterServiceController } from "./master-service.controller";

@injectable()
export class MasterServiceRouter {
  private readonly router: Router = Router();

  constructor(
    private readonly masterServiceController: MasterServiceController,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      requirePermissions("master.service.read"),
      validateQuery(QueryMasterServiceDTO),
      this.masterServiceController.getMasterServices,
    );

    this.router.get(
      "/:id",
      requirePermissions("master.service.read"),
      this.masterServiceController.getMasterServiceById,
    );

    this.router.post(
      "/",
      requirePermissions("master.service.create"),
      validateBody(CreateMasterServiceDTO),
      this.masterServiceController.createMasterService,
    );

    this.router.patch(
      "/:id",
      requirePermissions("master.service.update"),
      validateBody(UpdateMasterServiceDTO),
      this.masterServiceController.updateMasterService,
    );

    this.router.delete(
      "/:id",
      requirePermissions("master.service.delete"),
      this.masterServiceController.deleteMasterService,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
