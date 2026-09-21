import { Role } from "@prisma/client";
import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
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
    // USER MANAGEMENT & METRICS (Dilindungi Auth & Role)
    // ------------------------------------------

    this.router.get(
      "/metrics",
      authenticateToken,
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.getMetrics,
    );

    /**
     * GET /rbac/performance
     * Ambil data grafik performa tim (?period=7days|30days|3months)
     * Akses: OWNER, ADMIN
     */
    this.router.get(
      "/performance",
      authenticateToken,
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.getPerformance,
    );

    /**
     * GET /rbac/users
     * Filter: ?role=SALES_MANAGER&isActive=true&search=budi&page=1&limit=10
     * Akses: OWNER, ADMIN
     */
    this.router.get(
      "/users",
      authenticateToken,
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
      authenticateToken,
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
      authenticateToken,
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
      authenticateToken,
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
      authenticateToken,
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.toggleUserStatus,
    );

    /**
     * DELETE /rbac/users/:id
     * Hapus user secara permanen — hanya OWNER
     */
    this.router.delete(
      "/users/:id",
      authenticateToken,
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
      authenticateToken,
      requireRoles(...MANAGEMENT_ROLES),
      this.rbacController.getAuditLogs,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
