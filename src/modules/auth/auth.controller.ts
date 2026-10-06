import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AuthService } from "./auth.service";

@injectable()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await this.authService.login(req.body);

      res.cookie("token", result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain:
          process.env.NODE_ENV === "production"
            ? ".cathadigital.com"
            : undefined,
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: {
          user: result.user,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authUser = (req as any).user;
      const user = await this.authService.getCurrentUser(authUser.id);

      res.status(200).json({
        success: true,
        data: user,
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        domain:
          process.env.NODE_ENV === "production"
            ? ".cathadigital.com"
            : undefined,
        path: "/",
      });

      res.status(200).json({
        success: true,
        message: "Berhasil keluar sistem",
      });
    } catch (error) {
      next(error);
    }
  };
}
