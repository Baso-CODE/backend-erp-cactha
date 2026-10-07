import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../../helpers/request.helper";
import { ApiError } from "../../../utils/api-error";
import { QueryClientProjectDTO } from "../dto/query-client-project.dto";
import { ClientProjectService } from "../services/client-project.service";

@injectable()
export class ClientProjectController {
  constructor(private readonly clientProjectService: ClientProjectService) {}

  getProjects = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const query = (req as any).validatedQuery as QueryClientProjectDTO;

      const result = await this.clientProjectService.getProjects(
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

  getProjectById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const projectId = getStringParam(req.params.id);

      const data = await this.clientProjectService.getProjectById(
        projectId,
        actorId,
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
