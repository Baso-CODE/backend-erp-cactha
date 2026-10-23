import { AccessScope } from "@prisma/client";
import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PerformanceTikTokOAuthService } from "../services/performance-tiktok-oauth.service";

const COOKIE_NAME = "performance_tiktok_oauth_nonce";
const COOKIE_PATH = "/performance/oauth/tiktok";
const COOKIE_MAX_AGE = 5 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: COOKIE_PATH,
};

@injectable()
export class PerformanceTikTokOAuthController {
  constructor(
    private readonly service: PerformanceTikTokOAuthService,
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
          "Scope ALL diperlukan untuk menghubungkan TikTok Ads.",
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
      if (typeof req.query.error === "string") {
        throw new ApiError("TikTok Ads authorization dibatalkan.", 400);
      }

      const code =
        typeof req.query.auth_code === "string"
          ? req.query.auth_code
          : typeof req.query.code === "string"
            ? req.query.code
            : "";

      const state = req.query.state;
      const nonce = req.cookies?.[COOKIE_NAME];

      if (
        !code ||
        typeof state !== "string" ||
        typeof nonce !== "string" ||
        !state ||
        !nonce ||
        state.length > 8192
      ) {
        throw new ApiError("Parameter TikTok OAuth tidak valid.", 400);
      }

      this.clearNonce(res);

      const result = await this.service.handleCallback(code, state, nonce);

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({
        success: true,
        message: "TikTok Ads berhasil dihubungkan ke ERP Catha.",
        data: result,
      });
    } catch (error) {
      this.clearNonce(res);
      next(error);
    }
  };
}
