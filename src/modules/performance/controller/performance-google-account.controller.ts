import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PerformanceGoogleAccountService } from "../services/performance-google-account.service";

@injectable()
export class PerformanceGoogleAccountController {
  constructor(
    private readonly service: PerformanceGoogleAccountService,
    private readonly scopes: AccessScopeService,
  ) {}

  private getId(req: Request): string {
    const id = String(req.params.id ?? "");
    if (!isUUID(id, "4")) throw new ApiError("Connection ID tidak valid.", 400);
    return id;
  }

  private async requireAll(req: Request, permission: string): Promise<void> {
    const scope = await this.scopes.getPermissionScope(
      (req as any).user.id,
      permission,
    );
    if (scope !== "ALL")
      throw new ApiError(
        "Scope ALL diperlukan untuk mengakses akun integrasi.",
        403,
      );
  }

  getAccounts = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      await this.requireAll(req, "performance.connection.read");
      const data = await this.service.getAccounts(this.getId(req));
      res.status(200).json({ success: true, data });
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
      const data = await this.service.discover(this.getId(req));
      res.status(200).json({
        success: true,
        message: "Google Account Discovery berhasil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
