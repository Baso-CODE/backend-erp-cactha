import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";

import { CreateServiceCategoryDTO } from "./dto/create-service-category.dto";
import { UpdateServiceCategoryDTO } from "./dto/update-service-category.dto";
import { ServiceCategoryService } from "./service-category.service";

@injectable()
export class ServiceCategoryController {
  constructor(private readonly service: ServiceCategoryService) {}

  private actor(req: Request): string {
    const actorId = (req as any).user?.id;

    if (!actorId) {
      throw new ApiError("User tidak terautentikasi.", 401);
    }

    return actorId;
  }

  private categoryId(req: Request): string {
    const id = getStringParam(req.params.id);

    if (!isUUID(id, "4")) {
      throw new ApiError("Service category ID tidak valid.", 400);
    }

    return id;
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getAll(this.actor(req));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(
        this.categoryId(req),
        this.actor(req),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreateServiceCategoryDTO,
        this.actor(req),
      );

      res.status(201).json({
        success: true,
        message: "Service category berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        this.categoryId(req),
        req.body as UpdateServiceCategoryDTO,
        this.actor(req),
      );

      res.status(200).json({
        success: true,
        message: "Service category berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
