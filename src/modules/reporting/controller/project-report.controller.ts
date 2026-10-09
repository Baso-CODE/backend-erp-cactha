import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { QueryProjectReportDTO } from "../dto/query-project-report.dto";
import { ProjectReportService } from "../services/project-report.service";

@injectable()
export class ProjectReportController {
  constructor(private readonly projectReportService: ProjectReportService) {}

  getOverview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryProjectReportDTO;
      const actorId = (req as any).user.id;

      const data = await this.projectReportService.getOverview(query, actorId);

      res.status(200).json({
        success: true,
        message: "Project Report Overview berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getProgress = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryProjectReportDTO;
      const actorId = (req as any).user.id;

      const data = await this.projectReportService.getProgress(query, actorId);

      res.status(200).json({
        success: true,
        message: "Project Progress Report berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getTimeline = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryProjectReportDTO;
      const actorId = (req as any).user.id;

      const data = await this.projectReportService.getTimeline(query, actorId);

      res.status(200).json({
        success: true,
        message: "Project Timeline Report berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getFinancial = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryProjectReportDTO;
      const actorId = (req as any).user.id;

      const data = await this.projectReportService.getFinancial(query, actorId);

      res.status(200).json({
        success: true,
        message: "Project Financial Report berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
