// activity.controller.ts

import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ActivityService } from "./activity.service";

@injectable()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  getAllActivities = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const result = await this.activityService.getAllActivities(
        req.query as any,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Daftar activity berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getActivityById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const activity = await this.activityService.getActivityById(id, user.id);

      res.status(200).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  };

  createActivity = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const activity = await this.activityService.createActivity(
        req.body,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Activity berhasil dibuat.",
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  };

  updateActivity = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const activity = await this.activityService.updateActivity(
        id,
        req.body,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Activity berhasil diperbarui.",
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteActivity = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const result = await this.activityService.deleteActivity(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
