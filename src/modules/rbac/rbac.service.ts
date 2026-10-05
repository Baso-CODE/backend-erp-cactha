import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { injectable } from "tsyringe";

import { PrismaService } from "../prisma/prisma.service";
import { CreateUserDTO } from "./dto/create-user.dto";
import { QueryUserDTO } from "./dto/query-user.dto";
import { UpdateUserDTO } from "./dto/update-user.dto";

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
