import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || !user.role) {
      res.status(401).json({
        success: false,
        message: "Autentikasi gagal. Sesi tidak valid.",
      });
      return;
    }

    const allowedRolesString = allowedRoles.map((r) => String(r));

    if (!allowedRolesString.includes(String(user.role))) {
      res.status(403).json({
        success: false,
        message:
          "Akses ditolak. Anda tidak memiliki izin (role) untuk aksi ini.",
      });
      return;
    }

    next();
  };
};
