// auth.router.ts

import { Router } from "express";
import { injectable } from "tsyringe";

import { authenticateToken } from "../../middleware/auth.middleware";
import { validateBody } from "../../middleware/validateBody.middleware";
import { AuthController } from "./auth.controller";
import { ChangePasswordDTO } from "./dto/change-password.dto";
import { LoginDTO } from "./dto/login.dto";

@injectable()
export class AuthRouter {
  private readonly router: Router = Router();

  constructor(private readonly authController: AuthController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.post(
      "/login",
      validateBody(LoginDTO),
      this.authController.login,
    );

    this.router.get("/me", authenticateToken, this.authController.me);

    this.router.patch(
      "/change-password",
      authenticateToken,
      validateBody(ChangePasswordDTO),
      this.authController.changePassword,
    );

    this.router.post("/logout", authenticateToken, this.authController.logout);
  };

  getRouter(): Router {
    return this.router;
  }
}
