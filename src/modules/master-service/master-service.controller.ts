import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreateMasterServiceDTO } from "./dto/create-master-service.dto";
import { QueryMasterServiceDTO } from "./dto/query-master-service.dto";
import { UpdateMasterServiceDTO } from "./dto/update-master-service.dto";
import { MasterServiceService } from "./master-service.service";

@injectable()
export class MasterServiceController {
  constructor(private readonly masterServiceService: MasterServiceService) {}

  getMasterServices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const query = (req as any).validatedQuery as QueryMasterServiceDTO;

      const result = await this.masterServiceService.getMasterServices(
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Master service berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getMasterServiceById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const data = await this.masterServiceService.getMasterServiceById(
        id,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Detail master service berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createMasterService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const payload = req.body as CreateMasterServiceDTO;

      const data = await this.masterServiceService.createMasterService(
        payload,
        actorId,
      );

      res.status(201).json({
        success: true,
        message: "Master service berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMasterService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);
      const payload = req.body as UpdateMasterServiceDTO;

      const data = await this.masterServiceService.updateMasterService(
        id,
        payload,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Master service berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteMasterService = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const result = await this.masterServiceService.deleteMasterService(
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
