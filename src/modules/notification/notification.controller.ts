import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
import { QueryNotificationDTO } from "./dto/query-notification.dto";
import { NotificationService } from "./notification.service";

@injectable()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const recipientId = (req as any).user.id;
      const query = (req as any).validatedQuery as QueryNotificationDTO;

      const result = await this.notificationService.getAll(recipientId, query);

      res.status(200).json({
        success: true,
        message: "Notification berhasil diambil",
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
      const recipientId = (req as any).user.id;
      const id = getStringParam(req.params.id);

      const data = await this.notificationService.markAsRead(id, recipientId);

      res.status(200).json({
        success: true,
        message: "Notification berhasil ditandai sudah dibaca",
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
      const recipientId = (req as any).user.id;

      const data = await this.notificationService.markAllAsRead(recipientId);

      res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };
}
