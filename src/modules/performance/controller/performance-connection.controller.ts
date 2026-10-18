import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import {
  CreatePerformanceConnectionDTO,
  QueryPerformanceConnectionDTO,
  UpdatePerformanceConnectionDTO,
} from "../dto/performance-connection.dto";
import { PerformanceConnectionService } from "../services/performance-connection.service";

@injectable()
export class PerformanceConnectionController {
  constructor(private readonly service: PerformanceConnectionService) {}

  private id(req: Request): string {
    const id = String(req.params.id ?? "");
    if (!isUUID(id, "4")) throw new Error("Connection ID tidak valid.");
    return id;
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = (req as any)
        .validatedQuery as QueryPerformanceConnectionDTO;
      const data = await this.service.getAll(query, (req as any).user.id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getById(
        this.id(req),
        (req as any).user.id,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        req.body as CreatePerformanceConnectionDTO,
        (req as any).user.id,
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(
        this.id(req),
        req.body as UpdatePerformanceConnectionDTO,
        (req as any).user.id,
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.disable(
        this.id(req),
        (req as any).user.id,
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
