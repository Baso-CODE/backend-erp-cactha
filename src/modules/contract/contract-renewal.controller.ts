import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../utils/api-error";
import { ContractRenewalService } from "./contract-renewal.service";

@injectable()
export class ContractRenewalController {
  constructor(private readonly service: ContractRenewalService) {}

  getOverview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (typeof actorId !== "string" || !actorId) {
        throw new ApiError("Autentikasi tidak valid.", 401);
      }

      const getNumber = (key: string, fallback: number): number => {
        const value = req.query[key];
        if (value === undefined) return fallback;
        if (typeof value !== "string" || !/^\d+$/.test(value)) {
          throw new ApiError(`${key} harus angka bulat.`, 400);
        }
        return Number(value);
      };

      const filter = req.query.filter;

      if (
        filter !== undefined &&
        !["ALL", "UPCOMING", "EXPIRED"].includes(String(filter))
      ) {
        throw new ApiError("Filter Renewal tidak valid.", 400);
      }

      const data = await this.service.getOverview(actorId, {
        days: getNumber("days", 30),
        page: getNumber("page", 1),
        limit: getNumber("limit", 20),
        filter: (filter ?? "ALL") as "ALL" | "UPCOMING" | "EXPIRED",
      });

      res.status(200).json({
        success: true,
        message: "Contract Renewal Monitoring berhasil diambil.",
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };
}
