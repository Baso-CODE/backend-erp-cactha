import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const authenticateToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Akses ditolak. Token tidak ditemukan.",
    });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET as string, (err, decoded) => {
    if (err) {
      res.status(403).json({
        success: false,
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
      return;
    }

    // Sisipkan data payload (id, role) ke request
    (req as any).user = decoded;
    next();
  });
};
