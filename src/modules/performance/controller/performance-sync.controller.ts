import { AccessScope } from "@prisma/client";
import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { ExecutePerformanceSyncDTO } from "../dto/performance-sync.dto";
import { PerformanceSyncService } from "../services/performance-sync.service";

@injectable()
export class PerformanceSyncController {
  constructor(
    private readonly service: PerformanceSyncService,
    private readonly scopes: AccessScopeService,
  ) {}

  private getConnectionId(req: Request) {
    const id = String(req.params.id ?? "");
    if (!isUUID(id, "4")) {
      throw new ApiError("Connection ID tidak valid.", 400);
    }
    return id;
  }

  private async requireAll(req: Request, permission: string) {
    const scope = await this.scopes.getPermissionScope(
      (req as any).user.id,
      permission,
    );
    if (scope !== AccessScope.ALL) {
      throw new ApiError("Scope ALL diperlukan untuk operasi Sync.", 403);
    }
  }

  execute = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.requireAll(req, "performance.sync.execute");

      const data = await this.service.execute(
        this.getConnectionId(req),
        req.body as ExecutePerformanceSyncDTO,
        (req as any).user.id,
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getLogs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.requireAll(req, "performance.sync.read");
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);

      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      ) {
        throw new ApiError("Pagination tidak valid.", 400);
      }

      const data = await this.service.getLogs(
        this.getConnectionId(req),
        page,
        limit,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
