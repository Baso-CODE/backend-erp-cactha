import { AccessScope } from "@prisma/client";
import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import {
  CreatePerformanceMappingDTO,
  UpdatePerformanceMappingDTO,
} from "../dto/performance-mapping.dto";
import { PerformanceMappingService } from "../services/performance-mapping.service";

@injectable()
export class PerformanceMappingController {
  constructor(
    private readonly service: PerformanceMappingService,
    private readonly scopes: AccessScopeService,
  ) {}

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
        "Scope ALL diperlukan untuk mengelola Performance Mapping.",
        403,
      );
    }
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const accountId = req.query.accountId;
      if (
        accountId !== undefined &&
        (typeof accountId !== "string" || !isUUID(accountId, "4"))
      ) {
        throw new ApiError("accountId tidak valid.", 400);
      }

      const data = await this.service.getAll(
        accountId as string | undefined,
        this.actorId(req),
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.requireAll(req, "performance.mapping.create");

      const data = await this.service.create(
        req.body as CreatePerformanceMappingDTO,
        this.actorId(req),
      );

      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.requireAll(req, "performance.mapping.update");

      const id = String(req.params.id ?? "");
      if (!isUUID(id, "4")) {
        throw new ApiError("Mapping ID tidak valid.", 400);
      }

      const data = await this.service.update(
        id,
        req.body as UpdatePerformanceMappingDTO,
        this.actorId(req),
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
