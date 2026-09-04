import { Role } from "@prisma/client";
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
    const { role, isActive, search, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(role && { role }),
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
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          // Jangan expose password
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
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Relasi summary (opsional)
        _count: {
          select: {
            leadsManaged: true,
            clientsManaged: true,
            projectsManaged: true,
            tasksAssigned: true,
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
    // 1. Cek apakah email sudah digunakan
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new Error("Email sudah terdaftar. Gunakan email lain.");
    }

    // 2. Hash password
    const hashedPassword = await argon2.hash(data.password);

    // 3. Buat user baru + catat audit log dalam satu transaksi
    const newUser = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          password: hashedPassword,
          role: data.role,
          isActive: data.isActive ?? true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
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
            role: created.role,
          },
        },
      });

      return created;
    });

    return newUser;
  }

  async updateUser(id: string, data: UpdateUserDTO, actorId: string) {
    // 1. Pastikan user yang akan diupdate ada
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("User tidak ditemukan.");
    }

    // 2. Cek konflik email jika email diubah
    if (data.email && data.email !== existing.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailConflict) {
        throw new Error("Email sudah digunakan oleh user lain.");
      }
    }

    // 3. Hash password baru jika ada
    const updatePayload: Record<string, unknown> = { ...data };
    if (data.password) {
      updatePayload.password = await argon2.hash(data.password);
    }

    // 4. Update user + audit log dalam satu transaksi
    const updatedUser = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: updatePayload,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          updatedAt: true,
        },
      });

      // Catat perubahan (before vs after)
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
              role: existing.role,
              isActive: existing.isActive,
            },
            after: {
              name: updated.name,
              email: updated.email,
              role: updated.role,
              isActive: updated.isActive,
            },
          },
        },
      });

      return updated;
    });

    return updatedUser;
  }

  async deleteUser(id: string, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new Error("User tidak ditemukan.");
    }

    // Cegah user menghapus dirinya sendiri
    if (id === actorId) {
      throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "User",
          entityId: id,
          details: {
            name: existing.name,
            email: existing.email,
            role: existing.role,
          },
        },
      });
    });

    return { message: `User "${existing.name}" berhasil dihapus.` };
  }

  async toggleUserStatus(id: string, actorId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
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
        data: { isActive: newStatus },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: newStatus ? "ACTIVATE" : "DEACTIVATE",
          entity: "User",
          entityId: id,
          details: { previousStatus: existing.isActive, newStatus },
        },
      });

      return result;
    });

    return {
      message: `User "${updated.name}" berhasil ${newStatus ? "diaktifkan" : "dinonaktifkan"}.`,
      data: updated,
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
    page?: number;
    limit?: number;
  }) {
    const { entity, entityId, userId, action, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where = {
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(userId && { userId }),
      ...(action && { action }),
    };

    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ==========================================
  // HELPER: Daftar semua nilai Role yang valid
  // ==========================================
  getRoles(): string[] {
    return Object.values(Role);
  }
}
