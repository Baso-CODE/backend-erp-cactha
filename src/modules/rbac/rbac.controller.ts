import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { CreateRoleDTO } from "./dto/create-role.dto";
import { QueryUserOptionsDTO } from "./dto/query-user-options.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateRoleDTO } from "./dto/update-role.dto";
import { PermissionSyncService } from "./permission-sync.service";
import { RbacService } from "./rbac.service";
import { UserEligibilityService } from "./user-eligibility.service";

@injectable()
export class RbacController {
  constructor(
    private readonly rbacService: RbacService,
    private readonly userEligibilityService: UserEligibilityService,
    private readonly permissionSyncService: PermissionSyncService,
  ) {}

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  /**
   * GET /rbac/users
   * Ambil semua user dengan filter & paginasi
   */
  getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = plainToInstance(QueryUserDTO, req.query);

      await validateOrReject(query);

      const result = await this.rbacService.getAllUsers(query);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
  /**
   * GET /rbac/users/:id
   * Ambil detail satu user beserta jumlah entitas yang dikelola
   */
  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.rbacService.getUserById(id as string);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /rbac/users
   * Buat user baru dengan role tertentu (hanya OWNER/ADMIN)
   */
  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // req.user diisi oleh middleware autentikasi (JWT)
      const actorId = (req as any).user?.id;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Unauthorized." });
        return;
      }

      const newUser = await this.rbacService.createUser(req.body, actorId);

      res.status(201).json({
        success: true,
        message: "User berhasil dibuat.",
        data: newUser,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /rbac/users/:id
   * Perbarui data user (nama, email, role, status, atau password)
   */
  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Unauthorized." });
        return;
      }

      const updated = await this.rbacService.updateUser(
        id as string,
        req.body,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "User berhasil diperbarui.",
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /rbac/users/:id
   * Hapus user secara permanen
   */
  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Unauthorized." });
        return;
      }

      const result = await this.rbacService.deleteUser(id as string, actorId);

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /rbac/users/:id/toggle-status
   * Aktifkan atau nonaktifkan user (soft enable/disable)
   */
  toggleUserStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;
      if (!actorId) {
        res.status(401).json({ success: false, message: "Unauthorized." });
        return;
      }

      const result = await this.rbacService.toggleUserStatus(
        id as string,
        actorId,
      );

      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // AUDIT LOG
  // ==========================================

  /**
   * GET /rbac/audit-logs
   * Ambil daftar audit log dengan filter opsional
   * Query: entity, entityId, userId, action, page, limit
   */
  getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { entity, entityId, userId, action, search, page, limit } =
        req.query;

      const result = await this.rbacService.getAuditLogs({
        entity: entity as string | undefined,
        entityId: entityId as string | undefined,
        userId: userId as string | undefined,
        action: action as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  // ==========================================
  // HELPER
  // ==========================================

  /**
   * GET /rbac/roles
   * Kembalikan daftar semua Role yang tersedia di sistem
   */
  getRoles = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const roles = await this.rbacService.getRoles();

      res.status(200).json({
        success: true,
        data: roles,
      });
    } catch (error) {
      next(error);
    }
  };

  // Untuk mengisi 4 Kartu Metrik Paling Atas
  getMetrics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const metrics = await this.rbacService.getUserMetrics();
      res.status(200).json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  };

  // Untuk mengisi Grafik Area Chart
  getPerformance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = (req.query.period as any) || "7days";
      const chartData = await this.rbacService.getTeamPerformance(period);
      res.status(200).json({ success: true, data: chartData });
    } catch (error) {
      next(error);
    }
  };

  getUserOptions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = plainToInstance(QueryUserOptionsDTO, req.query);

      await validateOrReject(query);

      const data = await this.userEligibilityService.getEligibleUsers(query);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.permissionSyncService.getPermissions();

      res.status(200).json({
        success: true,
        data: result.permissions,
        grouped: result.grouped,
      });
    } catch (error) {
      next(error);
    }
  };

  syncPermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;

      const result = await this.permissionSyncService.sync(actorId);

      res.status(200).json({
        success: true,
        message: "Permission registry berhasil disinkronkan.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPermissionRegistryStatus = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.permissionSyncService.getRegistryStatus();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  getRoleById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const role = await this.rbacService.getRoleById(id as string);

      res.status(200).json({
        success: true,
        data: role,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRolePermissions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
        return;
      }

      const result = await this.rbacService.updateRolePermissions(
        id as string,
        req.body.permissions,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Hak akses role berhasil diperbarui.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
        return;
      }

      const role = await this.rbacService.createRole(
        req.body as CreateRoleDTO,
        actorId,
      );

      res.status(201).json({
        success: true,
        message: "Role berhasil dibuat.",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
        return;
      }

      const role = await this.rbacService.updateRole(
        id as string,
        req.body as UpdateRoleDTO,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Role berhasil diperbarui.",
        data: role,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteRole = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const actorId = (req as any).user?.id;

      if (!actorId) {
        res.status(401).json({
          success: false,
          message: "Unauthorized.",
        });
        return;
      }

      const result = await this.rbacService.deleteRole(id as string, actorId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
