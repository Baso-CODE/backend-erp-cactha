import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { QueryClientKpiDTO } from "../dto/query-client-kpi.dto";
import { ClientKpiService } from "../services/client-kpi.service";

@injectable()
export class ClientKpiController {
  constructor(private readonly service: ClientKpiService) {}

  getOverview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryClientKpiDTO;
      const actorId = (req as any).user.id;
      const data = await this.service.getOverview(query, actorId);

      res.status(200).json({
        success: true,
        message: "Client KPI Overview berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getRanking = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QueryClientKpiDTO;
      const actorId = (req as any).user.id;
      const data = await this.service.getRanking(query, actorId);

      res.status(200).json({
        success: true,
        message: "Client KPI Ranking berhasil diambil.",
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
      const query = (req as any).validatedQuery as QueryClientKpiDTO;
      const actorId = (req as any).user.id;
      const data = await this.service.getFinancial(query, actorId);

      res.status(200).json({
        success: true,
        message: "Client KPI Financial berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
