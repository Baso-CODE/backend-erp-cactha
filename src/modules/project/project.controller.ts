import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreateProjectDTO } from "./dto/create-project.dto";
import { QueryProjectDTO } from "./dto/query-project.dto";
import { UpdateProjectDTO } from "./dto/update-project.dto";
import { ProjectService } from "./project.service";

@injectable()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  getProjects = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const query = (req as any).validatedQuery as QueryProjectDTO;

      const result = await this.projectService.getProjects(query, actorId);

      res.status(200).json({
        success: true,
        message: "Project berhasil diambil.",
        ...result,
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
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const data = await this.projectService.getProjectById(id, actorId);

      res.status(200).json({
        success: true,
        message: "Detail project berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createProject = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const payload = req.body as CreateProjectDTO;

      const data = await this.projectService.createProject(payload, actorId);

      res.status(201).json({
        success: true,
        message: "Project berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateProject = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);
      const payload = req.body as UpdateProjectDTO;

      const data = await this.projectService.updateProject(
        id,
        payload,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Project berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteProject = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const result = await this.projectService.deleteProject(id, actorId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
