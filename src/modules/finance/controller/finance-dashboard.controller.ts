import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { FinanceDashboardService } from "../services/finance-dashboard.service";

@injectable()
export class FinanceDashboardController {
  constructor(
    private readonly financeDashboardService: FinanceDashboardService,
  ) {}

  getDashboard = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = await this.financeDashboardService.getDashboard(user.id);

      res.status(200).json({
        success: true,
        message: "Finance dashboard berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
