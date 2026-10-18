import { AccessScope } from "@prisma/client";
import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PerformanceGoogleOAuthService } from "../services/performance-google-oauth.service";

const COOKIE_NAME = "performance_google_oauth_nonce";
const COOKIE_PATH = "/performance/oauth/google";
const COOKIE_MAX_AGE = 5 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: COOKIE_PATH,
};

@injectable()
export class PerformanceGoogleOAuthController {
  constructor(
    private readonly service: PerformanceGoogleOAuthService,
    private readonly scopes: AccessScopeService,
  ) {}

  private clearNonce(res: Response): void {
    res.clearCookie(COOKIE_NAME, cookieOptions);
  }

  start = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id as string | undefined;
      const connectionId = String(req.params.connectionId ?? "");

      if (!actorId) {
        throw new ApiError("Autentikasi tidak valid.", 401);
      }

      if (!isUUID(connectionId, "4")) {
        throw new ApiError("Connection ID tidak valid.", 400);
      }

      const scope = await this.scopes.getPermissionScope(
        actorId,
        "performance.connection.update",
      );

      if (scope !== AccessScope.ALL) {
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
        ...cookieOptions,
        maxAge: COOKIE_MAX_AGE,
      });

      res.setHeader("Cache-Control", "no-store");
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
    try {
      const code = req.query.code;
      const state = req.query.state;
      const nonce = req.cookies?.[COOKIE_NAME];

      if (typeof req.query.error === "string") {
        throw new ApiError("Google OAuth ditolak atau dibatalkan.", 400);
      }

      if (
        typeof code !== "string" ||
        typeof state !== "string" ||
        typeof nonce !== "string" ||
        !code ||
        !state ||
        !nonce ||
        state.length > 8192
      ) {
        throw new ApiError(
          "Parameter Google OAuth tidak lengkap atau tidak valid.",
          400,
        );
      }

      this.clearNonce(res);

      const result = await this.service.handleCallback(code, state, nonce);

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        success: true,
        message: "Google OAuth berhasil. Silakan kembali ke ERP Catha.",
        data: result,
      });
    } catch (error) {
      this.clearNonce(res);
      next(error);
    }
  };
}
