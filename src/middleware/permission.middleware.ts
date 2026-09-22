// permission.middleware.ts

import { NextFunction, Request, Response } from "express";

export const requirePermissions = (...requiredPermissions: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Autentikasi gagal. Sesi tidak valid.",
      });
      return;
    }

    const userPermissions: string[] = user.permissions ?? [];

    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasPermission) {
      res.status(403).json({
        success: false,
        message:
          "Akses ditolak. Anda tidak memiliki permission untuk aksi ini.",
      });
      return;
    }

    next();
  };
};
