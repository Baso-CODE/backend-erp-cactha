import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { ClientDashboardService } from "../services/client-dashboard.service";

@injectable()
export class ClientDashboardController {
  constructor(
    private readonly clientDashboardService: ClientDashboardService,
  ) {}

  getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const data = await this.clientDashboardService.getDashboard(actorId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
