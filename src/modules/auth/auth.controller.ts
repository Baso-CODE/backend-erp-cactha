import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AuthService } from "./auth.service";

@injectable()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);

      res.status(200).json({
        success: true,
        message: "Login berhasil",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
