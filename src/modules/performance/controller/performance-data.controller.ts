import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { QueryPerformanceDataDTO } from "../dto/performance-data.dto";
import { PerformanceDataService } from "../services/performance-data.service";

@injectable()
export class PerformanceDataController {
  constructor(private readonly service: PerformanceDataService) {}
  getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.service.getAll((req as any).validatedQuery as QueryPerformanceDataDTO, (req as any).user.id);
      res.status(200).json({ success: true, data });
    } catch (error) { next(error); }
  };
}
