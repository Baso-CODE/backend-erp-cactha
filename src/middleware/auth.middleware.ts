import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { container } from "tsyringe";
import { PrismaService } from "../modules/prisma/prisma.service";

interface TokenPayload extends JwtPayload {
  userId: string;
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const token = req.cookies?.token;

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Akses ditolak. Token tidak ditemukan di cookie.",
    });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string,
    ) as TokenPayload;

    const prisma = container.resolve(PrismaService);

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
      },
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
      res.status(401).json({
        success: false,
        message: "Autentikasi gagal. User tidak ditemukan atau tidak aktif.",
      });
      return;
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

    (req as any).user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };

    next();
  } catch {
    res.status(403).json({
      success: false,
      message: "Token tidak valid atau sudah kedaluwarsa.",
    });
  }
};
