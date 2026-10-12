import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PerformanceGoogleOAuthService } from "../services/performance-google-oauth.service";

const COOKIE_NAME = "performance_google_oauth_nonce";
const COOKIE_PATH = "/performance/oauth/google";

@injectable()
export class PerformanceGoogleOAuthController {
  constructor(
    private readonly service: PerformanceGoogleOAuthService,
    private readonly scopes: AccessScopeService,
  ) {}

  start = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id as string;
      const connectionId = String(req.params.connectionId ?? "");

      if (!isUUID(connectionId, "4")) {
        throw new ApiError("Connection ID tidak valid.", 400);
      }

      const scope = await this.scopes.getPermissionScope(
        actorId,
        "performance.connection.update",
      );

      if (scope !== "ALL") {
        throw new ApiError(
          "Scope ALL diperlukan untuk menghubungkan akun.",
          403,
        );
      }

      const result = await this.service.createAuthorization(
        connectionId,
        actorId,
      );

      res.cookie(COOKIE_NAME, result.nonce, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: COOKIE_PATH,
        maxAge: 5 * 60 * 1000,
      });

      res.redirect(302, result.url);
    } catch (error) {
      next(error);
    }
  };

  callback = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const clearNonce = () => {
      res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: COOKIE_PATH,
      });
    };

    try {
      const code = typeof req.query.code === "string" ? req.query.code : "";
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const nonce = req.cookies?.[COOKIE_NAME];

      if (typeof req.query.error === "string") {
        clearNonce();
        throw new ApiError("Google OAuth ditolak atau dibatalkan.", 400);
      }

      if (!code || !state || typeof nonce !== "string") {
        clearNonce();
        throw new ApiError("Parameter Google OAuth tidak lengkap.", 400);
      }

      clearNonce();
      const result = await this.service.handleCallback(code, state, nonce);

      res.status(200).json({
        success: true,
        message: "Google OAuth berhasil. Silakan kembali ke ERP Catha.",
        data: result,
      });
    } catch (error) {
      clearNonce();
      next(error);
    }
  };
}
