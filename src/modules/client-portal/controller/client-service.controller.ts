import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { QueryClientServiceDTO } from "../dto/query-client-service.dto";
import { ClientServiceService } from "../services/client-service.service";

@injectable()
export class ClientServiceController {
  constructor(private readonly clientServiceService: ClientServiceService) {}

  getServices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const query = (req as any).validatedQuery as QueryClientServiceDTO;

      const result = await this.clientServiceService.getServices(
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}
