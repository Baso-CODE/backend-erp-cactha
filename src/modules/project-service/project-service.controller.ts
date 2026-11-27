import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { isUUID } from "class-validator";
import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";
import { ImportContractServicesDTO } from "../project/dto/import-contract-services.dto";
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
      const actorId = (req as any).user.id;
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
      const actorId = (req as any).user.id;
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
      const actorId = (req as any).user.id;
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
      const actorId = (req as any).user.id;
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
      const actorId = (req as any).user.id;
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

  getAvailableMasterServices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const projectId = getStringParam(req.params.projectId);

      if (!isUUID(projectId, "4")) {
        throw new ApiError("Project ID tidak valid.", 400);
      }

      const data = await this.projectServiceService.getAvailableMasterServices(
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

  getContractHandoff = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;

      const { projectId, contractId } = this.getHandoffParams(req);

      const data = await this.projectServiceService.getContractHandoff(
        projectId,
        contractId,
        actorId,
      );

      res.setHeader("Cache-Control", "private, no-store");

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  importContractServices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.id;

      const { projectId, contractId } = this.getHandoffParams(req);

      const data = await this.projectServiceService.importContractServices(
        projectId,
        contractId,
        req.body as ImportContractServicesDTO,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: `${data.createdCount} service berhasil di-import.`,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  private getHandoffParams(req: Request) {
    const projectId = getStringParam(req.params.projectId);

    const contractId = getStringParam(req.params.contractId);

    if (!isUUID(projectId, "4") || !isUUID(contractId, "4")) {
      throw new ApiError("Project ID atau Contract ID tidak valid.", 400);
    }

    return {
      projectId,
      contractId,
    };
  }
}
