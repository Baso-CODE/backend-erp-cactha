import { AccessScope } from "@prisma/client";
import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PerformanceTikTokAccountService } from "../services/performance-tiktok-account.service";

@injectable()
export class PerformanceTikTokAccountController {
  constructor(
    private readonly service: PerformanceTikTokAccountService,
    private readonly scopes: AccessScopeService,
  ) {}

  private getId(req: Request): string {
    const id = String(req.params.id ?? "");

    if (!isUUID(id, "4")) {
      throw new ApiError("Connection ID tidak valid.", 400);
    }

    return id;
  }

  private actorId(req: Request): string {
    const id = (req as any).user?.id;

    if (typeof id !== "string" || !id) {
      throw new ApiError("Autentikasi tidak valid.", 401);
    }

    return id;
  }

  private async requireAll(req: Request, permission: string): Promise<void> {
    const scope = await this.scopes.getPermissionScope(
      this.actorId(req),
      permission,
    );

    if (scope !== AccessScope.ALL) {
      throw new ApiError(
        "Scope ALL diperlukan untuk mengakses TikTok Ads.",
        403,
      );
    }
  }

  getAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.requireAll(req, "performance.connection.read");

      const data = await this.service.getAccounts(this.getId(req));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  discover = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.requireAll(req, "performance.connection.update");

      const data = await this.service.discover(
        this.getId(req),
        this.actorId(req),
      );

      res.status(200).json({
        success: true,
        message: "TikTok Advertiser Discovery berhasil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
