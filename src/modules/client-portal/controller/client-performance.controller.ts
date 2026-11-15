import { PerformancePlatform } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";

import { ClientPerformanceService } from "../services/client-performance.service";

const PLATFORMS = new Set<string>(Object.values(PerformancePlatform));

@injectable()
export class ClientPerformanceController {
  constructor(private readonly service: ClientPerformanceService) {}

  getReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const platformValue = req.query.platform;
      const fromValue = req.query.dateFrom;
      const toValue = req.query.dateTo;

      if (
        platformValue !== undefined &&
        (typeof platformValue !== "string" || !PLATFORMS.has(platformValue))
      ) {
        throw new ApiError("Platform tidak valid.", 400);
      }

      if (
        (fromValue !== undefined && typeof fromValue !== "string") ||
        (toValue !== undefined && typeof toValue !== "string")
      ) {
        throw new ApiError("Parameter tanggal tidak valid.", 400);
      }

      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);

      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (page - 1) * limit > 1_000_000
      ) {
        throw new ApiError("Pagination tidak valid.", 400);
      }

      const result = await this.service.getReport(actorId, {
        ...(platformValue && {
          platform: platformValue as PerformancePlatform,
        }),
        ...(fromValue && {
          dateFrom: fromValue,
        }),
        ...(toValue && {
          dateTo: toValue,
        }),
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        message: "Performance Report berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
