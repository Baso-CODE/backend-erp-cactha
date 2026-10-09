import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { QueryRevenueReportDTO } from "../dto/query-revenue-report.dto";
import { RevenueReportService } from "../services/revenue-report.service";

@injectable()
export class RevenueReportController {
  constructor(private readonly revenueReportService: RevenueReportService) {}

  getSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryRevenueReportDTO;

      const data = await this.revenueReportService.getSummary(query, user.id);

      res.status(200).json({
        success: true,
        message: "Revenue Report berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getTrend = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryRevenueReportDTO;

      const data = await this.revenueReportService.getTrend(query, user.id);

      res.status(200).json({
        success: true,
        message: "Revenue Trend berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getRevenueByClients = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryRevenueReportDTO;

      const data = await this.revenueReportService.getRevenueByClients(
        query,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Revenue by Client berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getRevenueByProjects = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryRevenueReportDTO;

      const data = await this.revenueReportService.getRevenueByProjects(
        query,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Revenue by Project berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
