import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { ClientNotificationService } from "../services/client-notification.service";

@injectable()
export class ClientNotificationController {
  constructor(private readonly service: ClientNotificationService) {}

  private getActorId(req: Request): string {
    const id = (req as any).user?.id;

    if (typeof id !== "string" || !id) {
      throw new ApiError("User tidak terautentikasi.", 401);
    }

    return id;
  }

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = this.getActorId(req);

      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 20);

      if (
        !Number.isInteger(page) ||
        page < 1 ||
        !Number.isInteger(limit) ||
        limit < 1 ||
        limit > 100 ||
        (page - 1) * limit > 1_000_000
      ) {
        throw new ApiError("Pagination tidak valid.", 400);
      }

      let isRead: boolean | undefined;

      if (req.query.isRead !== undefined) {
        if (req.query.isRead !== "true" && req.query.isRead !== "false") {
          throw new ApiError("Filter isRead tidak valid.", 400);
        }

        isRead = req.query.isRead === "true";
      }

      const result = await this.service.getAll(actorId, {
        page,
        limit,
        ...(isRead !== undefined && { isRead }),
      });

      res.status(200).json({
        success: true,
        message: "Notifikasi Client Portal berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = this.getActorId(req);
      const id = req.params.id;

      if (typeof id !== "string" || !isUUID(id, "4")) {
        throw new ApiError("Notification ID tidak valid.", 400);
      }

      const data = await this.service.markAsRead(id, actorId);

      res.status(200).json({
        success: true,
        message: "Notifikasi berhasil ditandai sudah dibaca.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = this.getActorId(req);

      const data = await this.service.markAllAsRead(actorId);

      res.status(200).json({
        success: true,
        message: "Semua notifikasi portal ditandai sudah dibaca.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
