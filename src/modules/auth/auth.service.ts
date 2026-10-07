// auth.service.ts

import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import { injectable } from "tsyringe";

import { PrismaService } from "../prisma/prisma.service";
import { ChangePasswordDTO } from "./dto/change-password.dto";
import { LoginDTO } from "./dto/login.dto";

@injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(data: LoginDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error("Email atau password salah.");
    }

    if (!user.isActive) {
      throw new Error(
        "Akun Anda dinonaktifkan. Silakan hubungi Administrator.",
      );
    }

    const validPassword = await argon2.verify(user.password, data.password);

    if (!validPassword) {
      throw new Error("Email atau password salah.");
    }

    const roles = user.roles.map((userRole) => userRole.role.code);

    const permissions = [
      ...new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.code,
          ),
        ),
      ),
    ];

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET belum dikonfigurasi di server.");
    }

    const token = jwt.sign(
      {
        userId: user.id,
      },
      secret,
      {
        expiresIn: "1d",
      },
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        roles,
        permissions,
      },
      token,
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new Error("User tidak ditemukan atau sudah tidak aktif.");
    }

    const roles = user.roles.map((userRole) => userRole.role.code);

    const permissions = [
      ...new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.code,
          ),
        ),
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roles,
      permissions,
    };
  }

  async changePassword(userId: string, data: ChangePasswordDTO) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        password: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      throw new Error("User tidak ditemukan atau sudah tidak aktif.");
    }

    const validPassword = await argon2.verify(
      user.password,
      data.currentPassword,
    );

    if (!validPassword) {
      throw new Error("Password saat ini tidak sesuai.");
    }

    const samePassword = await argon2.verify(user.password, data.newPassword);

    if (samePassword) {
      throw new Error(
        "Password baru tidak boleh sama dengan password saat ini.",
      );
    }

    const hashedPassword = await argon2.hash(data.newPassword);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: {
          id: userId,
        },
        data: {
          password: hashedPassword,
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: "UPDATE",
          entity: "UserPassword",
          entityId: userId,
          details: {
            changedAt: new Date().toISOString(),
          },
        },
      });
    });

    return {
      message: "Password berhasil diperbarui.",
    };
  }
}
