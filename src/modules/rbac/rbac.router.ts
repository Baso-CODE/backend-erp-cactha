import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { requirePermissions } from "../../middleware/permission.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateRoleDTO } from "./dto/create-role.dto";
import { CreateUserDTO } from "./dto/create-user.dto";
import { QueryUserOptionsDTO } from "./dto/query-user-options.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateRolePermissionsDTO } from "./dto/update-role-permissions.dto";
import { UpdateRoleDTO } from "./dto/update-role.dto";
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

    this.router.post(
      "/roles",
      authenticateToken,
      requirePermissions("admin.role.create"),
      validateBody(CreateRoleDTO),
      this.rbacController.createRole,
    );

    this.router.get(
      "/roles/:id",
      authenticateToken,
      requirePermissions("admin.role.read"),
      this.rbacController.getRoleById,
    );

    this.router.patch(
      "/roles/:id",
      authenticateToken,
      requirePermissions("admin.role.update"),
      validateBody(UpdateRoleDTO),
      this.rbacController.updateRole,
    );

    this.router.put(
      "/roles/:id/permissions",
      authenticateToken,
      requirePermissions("admin.permission.manage"),
      validateBody(UpdateRolePermissionsDTO),
      this.rbacController.updateRolePermissions,
    );

    this.router.delete(
      "/roles/:id",
      authenticateToken,
      requirePermissions("admin.role.delete"),
      this.rbacController.deleteRole,
    );

    this.router.get(
      "/permissions",
      authenticateToken,
      requirePermissions("admin.permission.read"),
      this.rbacController.getPermissions,
    );

    this.router.get(
      "/permissions/registry-status",
      authenticateToken,
      requirePermissions("admin.permission.read"),
      this.rbacController.getPermissionRegistryStatus,
    );

    this.router.post(
      "/permissions/sync",
      authenticateToken,
      requirePermissions("admin.permission.manage"),
      this.rbacController.syncPermissions,
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
      "/users/options",
      authenticateToken,
      validateQuery(QueryUserOptionsDTO),
      this.rbacController.getUserOptions,
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
