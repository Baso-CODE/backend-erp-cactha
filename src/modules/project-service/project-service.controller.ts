import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreateProjectServiceDTO } from "./dto/create-project-service.dto";
import { QueryProjectServiceDTO } from "./dto/query-project-service.dto";
import { UpdateProjectServiceDTO } from "./dto/update-project-service.dto";
import { ProjectServiceService } from "./project-service.service";

@injectable()
export class ProjectServiceController {
  constructor(private readonly projectServiceService: ProjectServiceService) {}

  getProjectServices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const query = (req as any).validatedQuery as QueryProjectServiceDTO;

      const result = await this.projectServiceService.getProjectServices(
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Project service berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getProjectServiceById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const data = await this.projectServiceService.getProjectServiceById(
        id,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Detail project service berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createProjectService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const payload = req.body as CreateProjectServiceDTO;

      const data = await this.projectServiceService.createProjectService(
        payload,
        actorId,
      );

      res.status(201).json({
        success: true,
        message: "Project service berhasil ditambahkan.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProjectService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);
      const payload = req.body as UpdateProjectServiceDTO;

      const data = await this.projectServiceService.updateProjectService(
        id,
        payload,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Project service berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProjectService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const result = await this.projectServiceService.deleteProjectService(
        id,
        actorId,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
