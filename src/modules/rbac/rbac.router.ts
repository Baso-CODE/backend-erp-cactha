import { Role } from "@prisma/client";
import { Router } from "express";
import { injectable } from "tsyringe";

import { requireRoles } from "../../middleware/role.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { CreateUserDTO } from "./dto/create-user.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateUserDTO } from "./dto/update-user.dto";
import { RbacController } from "./rbac.controller";

// Alias kumpulan role yang bisa mengakses manajemen user
const MANAGEMENT_ROLES = [Role.OWNER, Role.ADMIN];

@injectable()
export class RbacRouter {
  private readonly router: Router = Router();

  constructor(private readonly rbacController: RbacController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    // ------------------------------------------
    // HELPER — Tidak perlu auth khusus
    // ------------------------------------------

    /**
     * GET /rbac/roles
     * Daftar semua role yang tersedia di sistem
     */
    this.router.get("/roles", this.rbacController.getRoles);

    // ------------------------------------------
    // USER MANAGEMENT
    // ------------------------------------------

    /**
     * GET /rbac/users
     * Filter: ?role=SALES_MANAGER&isActive=true&search=budi&page=1&limit=10
     * Akses: OWNER, ADMIN
     */
    this.router.get(
      "/users",
      requireRoles(...MANAGEMENT_ROLES),
      validateQuery(QueryUserDTO),
      this.rbacController.getAllUsers,
    );

    /**
     * GET /rbac/users/:id
     * Akses: OWNER, ADMIN
     */
    this.router.get(
      "/users/:id",
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.getUserById,
    );

    /**
     * POST /rbac/users
     * Body: CreateUserDTO
     * Akses: OWNER, ADMIN
     */
    this.router.post(
      "/users",
      requireRoles(...MANAGEMENT_ROLES),
      validateBody(CreateUserDTO),
      this.rbacController.createUser,
    );

    /**
     * PATCH /rbac/users/:id
     * Body: UpdateUserDTO (semua field opsional)
     * Akses: OWNER, ADMIN
     */
    this.router.patch(
      "/users/:id",
      requireRoles(...MANAGEMENT_ROLES),
      validateBody(UpdateUserDTO),
      this.rbacController.updateUser,
    );

    /**
     * PATCH /rbac/users/:id/toggle-status
     * Aktifkan / nonaktifkan user tanpa menghapus data
     * Akses: OWNER, ADMIN
     */
    this.router.patch(
      "/users/:id/toggle-status",
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.toggleUserStatus,
    );

    /**
     * DELETE /rbac/users/:id
     * Hapus user secara permanen — hanya OWNER
     */
    this.router.delete(
      "/users/:id",
      requireRoles(Role.OWNER),
      this.rbacController.deleteUser,
    );

    // ------------------------------------------
    // AUDIT LOG
    // ------------------------------------------

    /**
     * GET /rbac/audit-logs
     * Filter: ?entity=User&action=DELETE&userId=xxx&page=1&limit=20
     * Akses: OWNER, ADMIN
     */
    this.router.get(
      "/audit-logs",
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.getAuditLogs,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
