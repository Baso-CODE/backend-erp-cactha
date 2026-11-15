import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { ApiError } from "../../utils/api-error";
import {
  CreateDeliverableInput,
  DeliverableService,
  UpdateDeliverableInput,
} from "./deliverable.service";

@injectable()
export class DeliverableController {
  constructor(private readonly service: DeliverableService) {}

  private actor(req: Request): string {
    const actorId = (req as any).user?.id;

    if (!actorId) {
      throw new ApiError("Tidak terautentikasi.", 401);
    }

    return actorId;
  }

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = req.body as CreateDeliverableInput;

      if (!isUUID(input.projectId, "4")) {
        throw new ApiError("Project ID tidak valid.", 400);
      }

      const data = await this.service.createDraft(input, this.actor(req));

      res.status(201).json({
        success: true,
        message: "Draft deliverable berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const projectId = req.query.projectId;

      if (typeof projectId !== "string" || !isUUID(projectId, "4")) {
        throw new ApiError("Project ID tidak valid.", 400);
      }

      const data = await this.service.getAll(projectId, this.actor(req));

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  submit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Deliverable ID tidak valid.", 400);
      }

      const data = await this.service.submitForApproval(id, this.actor(req));

      res.status(200).json({
        success: true,
        message: "Deliverable berhasil dikirim untuk approval.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  startReview = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Deliverable ID tidak valid.", 400);
      }

      const data = await this.service.startReview(id, this.actor(req));

      res.status(200).json({
        success: true,
        message: "Review internal berhasil dimulai.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  markReady = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Deliverable ID tidak valid.", 400);
      }

      const data = await this.service.markReady(id, this.actor(req));

      res.status(200).json({
        success: true,
        message: "Deliverable siap dikirim kepada client.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  reopenDraft = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Deliverable ID tidak valid.", 400);
      }

      const data = await this.service.reopenDraft(id, this.actor(req));

      res.status(200).json({
        success: true,
        message: "Deliverable dikembalikan ke draft.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Deliverable ID tidak valid.", 400);
      }

      const data = await this.service.updateDraft(
        id,
        req.body as UpdateDeliverableInput,
        this.actor(req),
      );

      res.status(200).json({
        success: true,
        message: "Draft deliverable berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
