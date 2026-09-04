import { Router } from "express";
import { injectable } from "tsyringe";
import { validateBody } from "../../middleware/validateBody.middleware";
import { AuthController } from "./auth.controller";
import { LoginDTO } from "./dto/login.dto";

@injectable()
export class AuthRouter {
  private readonly router: Router = Router();

  constructor(private readonly authController: AuthController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    // Endpoint Login Publik
    this.router.post(
      "/login",
      validateBody(LoginDTO),
      this.authController.login,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
