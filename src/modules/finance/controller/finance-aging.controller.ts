import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { FinanceAgingService } from "../services/finance-aging.service";

@injectable()
export class FinanceAgingController {
  constructor(private readonly financeAgingService: FinanceAgingService) {}

  getAging = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = await this.financeAgingService.getAging(user.id);

      res.status(200).json({
        success: true,
        message: "Accounts receivable aging berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
