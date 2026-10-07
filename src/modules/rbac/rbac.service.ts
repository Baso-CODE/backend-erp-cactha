import { AccessScope, Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { injectable } from "tsyringe";

import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDTO } from "./dto/create-role.dto";
import { CreateUserDTO } from "./dto/create-user.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateRoleDTO } from "./dto/update-role.dto";
import { UpdateUserDTO } from "./dto/update-user.dto";
import { PermissionRegistryLoader } from "./permission-registry.loader";

@injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getAllUsers(query: QueryUserDTO) {
    const { roleId, isActive, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(roleId && {
        roles: {
          some: { roleId },
        },
      }),
      ...(isActive !== undefined && { isActive }),
      ...(search && {
        OR: [{ name: { contains: search } }, { email: { contains: search } }],
      }),
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
        },
        _count: {
          select: {
            leadsManaged: true,
            clientsManaged: true,
            projectsManaged: true,
            assignedTasks: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error("User tidak ditemukan.");
    }

    return user;
  }

  async createUser(data: CreateUserDTO, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Email sudah terdaftar. Gunakan email lain.");
    }

    const roleIds = [...new Set(data.roleIds)];

    await this.validateRoleIds(roleIds);

    const hashedPassword = await argon2.hash(data.password);

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashedPassword,
          isActive: data.isActive ?? true,
          roles: {
            create: roleIds.map((roleId) => ({
              role: {
                connect: { id: roleId },
              },
            })),
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "User",
          entityId: created.id,
          details: {
            name: created.name,
            email: created.email,
            isActive: created.isActive,
            roles: created.roles.map(({ role }) => ({
              id: role.id,
              code: role.code,
              name: role.name,
            })),
          },
        },
      });

      return created;
    });
  }

  async updateUser(id: string, data: UpdateUserDTO, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("User tidak ditemukan.");
    }

    if (data.email && data.email !== existing.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: data.email },
      });

      if (emailConflict) {
        throw new Error("Email sudah digunakan oleh user lain.");
      }
    }

    let roleIds: string[] | undefined;

    if (data.roleIds) {
      roleIds = [...new Set(data.roleIds)];
      await this.validateRoleIds(roleIds);
    }

    const hashedPassword = data.password
      ? await argon2.hash(data.password)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...(data.email !== undefined && { email: data.email }),
          ...(data.name !== undefined && { name: data.name }),
          ...(hashedPassword !== undefined && { password: hashedPassword }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),

          ...(roleIds !== undefined && {
            roles: {
              deleteMany: {},
              create: roleIds.map((roleId) => ({
                role: {
                  connect: { id: roleId },
                },
              })),
            },
          }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          updatedAt: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "User",
          entityId: id,
          details: {
            before: {
              name: existing.name,
              email: existing.email,
              isActive: existing.isActive,
              roles: existing.roles.map(({ role }) => ({
                id: role.id,
                code: role.code,
                name: role.name,
              })),
            },
            after: {
              name: updated.name,
              email: updated.email,
              isActive: updated.isActive,
              roles: updated.roles.map(({ role }) => ({
                id: role.id,
                code: role.code,
                name: role.name,
              })),
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteUser(id: string, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("User tidak ditemukan.");
    }

    if (id === actorId) {
      throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "User",
          entityId: id,
          details: {
            name: existing.name,
            email: existing.email,
            roles: existing.roles.map(({ role }) => ({
              id: role.id,
              code: role.code,
              name: role.name,
            })),
          },
        },
      });
    });

    return {
      message: `User "${existing.name}" berhasil dihapus.`,
    };
  }

  async toggleUserStatus(id: string, actorId: string) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("User tidak ditemukan.");
    }

    if (id === actorId) {
      throw new Error("Anda tidak dapat menonaktifkan akun Anda sendiri.");
    }

    const newStatus = !existing.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: {
          isActive: newStatus,
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          roles: {
            select: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: newStatus ? "ACTIVATE" : "DEACTIVATE",
          entity: "User",
          entityId: id,
          details: {
            previousStatus: existing.isActive,
            newStatus,
          },
        },
      });

      return result;
    });

    return {
      message: `User "${updated.name}" berhasil ${
        newStatus ? "diaktifkan" : "dinonaktifkan"
      }.`,
      data: updated,
    };
  }

  // ==========================================
  // ROLE MANAGEMENT
  // ==========================================

  async getRoles() {
    return this.prisma.role.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
      },
      orderBy: {
        name: "asc",
      },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isSystem: true,
        isActive: true,
        permissions: {
          select: {
            scope: true,
            permission: {
              select: {
                id: true,
                code: true,
                module: true,
                action: true,
                description: true,
              },
            },
          },
          orderBy: {
            permission: {
              module: "asc",
            },
          },
        },
      },
    });

    if (!role) {
      throw new Error("Role tidak ditemukan.");
    }

    return role;
  }

  async updateRolePermissions(
    roleId: string,
    permissions: {
      permissionId: string;
      scope: AccessScope;
    }[],
    actorId: string,
  ) {
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        code: true,
        name: true,
        isSystem: true,
      },
    });

    if (!role) {
      throw new ApiError("Role tidak ditemukan.", 404);
    }

    if (role.code === "OWNER") {
      throw new ApiError(
        "Permission role OWNER tidak dapat diubah secara manual.",
        400,
      );
    }

    const uniquePermissionIds = [
      ...new Set(permissions.map((item) => item.permissionId)),
    ];

    if (uniquePermissionIds.length !== permissions.length) {
      throw new ApiError("Permission tidak boleh duplikat.", 400);
    }

    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        id: {
          in: uniquePermissionIds,
        },
      },
      select: {
        id: true,
        code: true,
      },
    });

    if (existingPermissions.length !== uniquePermissionIds.length) {
      throw new ApiError("Satu atau lebih permission tidak valid.", 400);
    }

    const registry = PermissionRegistryLoader.load();

    const registryMap = new Map(
      registry.map((permission) => [permission.code, permission]),
    );

    const permissionCodeById = new Map(
      existingPermissions.map((permission) => [permission.id, permission.code]),
    );

    const defaultScopes: AccessScope[] = [
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
      AccessScope.CLIENT,
      AccessScope.ALL,
    ];

    for (const item of permissions) {
      const permissionCode = permissionCodeById.get(item.permissionId);

      if (!permissionCode) {
        throw new ApiError("Permission tidak valid.", 400);
      }

      const definition = registryMap.get(permissionCode);

      const allowedScopes = definition?.allowedScopes ?? defaultScopes;

      if (!allowedScopes.includes(item.scope)) {
        throw new ApiError(
          `Scope "${item.scope}" tidak diizinkan untuk permission "${permissionCode}".`,
          400,
        );
      }
    }

    const before = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
      },
      select: {
        scope: true,
        permission: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: {
          roleId,
        },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((item) => ({
            roleId,
            permissionId: item.permissionId,
            scope: item.scope,
          })),
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE_ROLE_PERMISSIONS",
          entity: "Role",
          entityId: roleId,
          details: {
            roleCode: role.code,
            before: before.map((item) => ({
              permissionId: item.permission.id,
              permissionCode: item.permission.code,
              scope: item.scope,
            })),
            after: permissions,
          },
        },
      });
    });

    return this.getRoleById(roleId);
  }
  async createRole(data: CreateRoleDTO, actorId: string) {
    const existing = await this.prisma.role.findUnique({
      where: {
        code: data.code,
      },
    });

    if (existing) {
      throw new ApiError(
        `Role dengan code "${data.code}" sudah tersedia.`,
        409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          code: data.code,
          name: data.name,
          description: data.description,
          isActive: data.isActive ?? true,
          isSystem: false,
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isSystem: true,
          isActive: true,
          createdAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Role",
          entityId: role.id,
          details: {
            code: role.code,
            name: role.name,
            isActive: role.isActive,
          },
        },
      });

      return role;
    });
  }

  async updateRole(roleId: string, data: UpdateRoleDTO, actorId: string) {
    const existing = await this.prisma.role.findUnique({
      where: {
        id: roleId,
      },
    });

    if (!existing) {
      throw new ApiError("Role tidak ditemukan.", 404);
    }

    if (existing.code === "OWNER" && data.isActive === false) {
      throw new ApiError("Role OWNER tidak dapat dinonaktifkan.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: {
          id: roleId,
        },
        data: {
          ...(data.name !== undefined && {
            name: data.name,
          }),
          ...(data.description !== undefined && {
            description: data.description,
          }),
          ...(data.isActive !== undefined && {
            isActive: data.isActive,
          }),
        },
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          isSystem: true,
          isActive: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Role",
          entityId: roleId,
          details: {
            before: {
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
            },
            after: {
              name: updated.name,
              description: updated.description,
              isActive: updated.isActive,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteRole(roleId: string, actorId: string) {
    const existing = await this.prisma.role.findUnique({
      where: {
        id: roleId,
      },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Role tidak ditemukan.", 404);
    }

    if (existing.isSystem) {
      throw new ApiError("System role tidak dapat dihapus.", 400);
    }

    if (existing._count.users > 0) {
      throw new ApiError(
        `Role "${existing.name}" masih digunakan oleh ${existing._count.users} user.`,
        400,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.delete({
        where: {
          id: roleId,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Role",
          entityId: roleId,
          details: {
            code: existing.code,
            name: existing.name,
            permissions: existing._count.permissions,
          },
        },
      });
    });

    return {
      message: `Role "${existing.name}" berhasil dihapus.`,
    };
  }

  // ==========================================
  // AUDIT LOG
  // ==========================================

  async getAuditLogs(filters: {
    entity?: string;
    entityId?: string;
    userId?: string;
    action?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const {
      entity,
      entityId,
      userId,
      action,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action }),
      ...(search && {
        OR: [
          {
            action: {
              contains: search,
            },
          },
          {
            entity: {
              contains: search,
            },
          },
          {
            entityId: {
              contains: search,
            },
          },
          {
            user: {
              is: {
                OR: [
                  {
                    name: {
                      contains: search,
                    },
                  },
                  {
                    email: {
                      contains: search,
                    },
                  },
                ],
              },
            },
          },
        ],
      }),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              roles: {
                select: {
                  role: {
                    select: {
                      id: true,
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),

      this.prisma.auditLog.count({
        where,
      }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  // ==========================================
  // DASHBOARD & PERFORMANCE METRICS
  // ==========================================

  async getUserMetrics() {
    const [totalUsers, activeUsers] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({
        where: {
          isActive: true,
        },
      }),
    ]);

    const inactiveUsers = totalUsers - activeUsers;

    // TODO: Ganti dengan perhitungan dari Task / Project.
    const averageEfficiency = 91.4;

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      averageEfficiency,
    };
  }

  async getTeamPerformance(period: "7days" | "30days" | "3months" = "7days") {
    // TODO: Nantinya dihitung dari Task / Project berdasarkan period.
    void period;

    return [
      { date: "Jun 24", performance: 40 },
      { date: "Jun 25", performance: 30 },
      { date: "Jun 26", performance: 65 },
      { date: "Jun 27", performance: 85 },
      { date: "Jun 28", performance: 50 },
      { date: "Jun 29", performance: 70 },
      { date: "Jun 30", performance: 95 },
    ];
  }

  // ==========================================
  // PRIVATE HELPERS
  // ==========================================

  private async validateRoleIds(roleIds: string[]): Promise<void> {
    const roles = await this.prisma.role.findMany({
      where: {
        id: {
          in: roleIds,
        },
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (roles.length !== roleIds.length) {
      throw new Error(
        "Satu atau lebih role tidak valid atau sudah tidak aktif.",
      );
    }
  }
}
