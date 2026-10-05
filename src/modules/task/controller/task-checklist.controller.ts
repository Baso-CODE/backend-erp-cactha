import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";

import { getStringParam } from "../../../helpers/request.helper";
import { CreateTaskChecklistDTO } from "../dto/create-task-checklist.dto";
import { UpdateTaskChecklistDTO } from "../dto/update-task-checklist.dto";
import { TaskChecklistService } from "../service/task-checklist.service";

@injectable()
export class TaskChecklistController {
  constructor(
    @inject(TaskChecklistService)
    private readonly taskChecklistService: TaskChecklistService,
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const taskId = getStringParam(req.params.taskId);

      const data = await this.taskChecklistService.getAll(taskId, actorId);

      return res.status(200).json({
        success: true,
        message: "Checklist task berhasil diambil",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const taskId = getStringParam(req.params.taskId);
      const dto = req.body as CreateTaskChecklistDTO;

      const data = await this.taskChecklistService.create(taskId, actorId, dto);

      return res.status(201).json({
        success: true,
        message: "Checklist berhasil dibuat",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);
      const dto = req.body as UpdateTaskChecklistDTO;

      const data = await this.taskChecklistService.update(id, actorId, dto);

      return res.status(200).json({
        success: true,
        message: "Checklist berhasil diperbarui",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);

      const result = await this.taskChecklistService.delete(id, actorId);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
