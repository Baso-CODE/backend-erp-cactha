import { Role } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

export const requireRoles = (...allowedRoles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    // Pastikan user ada dan role-nya termasuk dalam array allowedRoles
    if (!user || !allowedRoles.includes(user.role)) {
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
