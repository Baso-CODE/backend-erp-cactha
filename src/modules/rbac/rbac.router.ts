import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateUserDTO } from "./dto/create-user.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateUserDTO } from "./dto/update-user.dto";
import { RbacController } from "./rbac.controller";

@injectable()
export class RbacRouter {
  private readonly router: Router = Router();

  constructor(private readonly rbacController: RbacController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.get(
      "/roles",
      authenticateToken,
      requirePermissions("admin.role.read"),
      this.rbacController.getRoles,
    );

    this.router.get(
      "/metrics",
      authenticateToken,
      requirePermissions("admin.user.read"),
      this.rbacController.getMetrics,
    );

    this.router.get(
      "/performance",
      authenticateToken,
      requirePermissions("admin.user.read"),
      this.rbacController.getPerformance,
    );

    this.router.get(
      "/users",
      authenticateToken,
      requirePermissions("admin.user.read"),
      validateQuery(QueryUserDTO),
      this.rbacController.getAllUsers,
    );

    this.router.get(
      "/users/:id",
      authenticateToken,
      requirePermissions("admin.user.read"),
      this.rbacController.getUserById,
    );

    this.router.post(
      "/users",
      authenticateToken,
      requirePermissions("admin.user.create"),
      validateBody(CreateUserDTO),
      this.rbacController.createUser,
    );

    this.router.patch(
      "/users/:id",
      authenticateToken,
      requirePermissions("admin.user.update"),
      validateBody(UpdateUserDTO),
      this.rbacController.updateUser,
    );

    this.router.patch(
      "/users/:id/toggle-status",
      authenticateToken,
      requirePermissions("admin.user.update"),
      this.rbacController.toggleUserStatus,
    );

    this.router.delete(
      "/users/:id",
      authenticateToken,
      requirePermissions("admin.user.delete"),
      this.rbacController.deleteUser,
    );

    this.router.get(
      "/audit-logs",
      authenticateToken,
      requirePermissions("admin.audit.read"),
      this.rbacController.getAuditLogs,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
