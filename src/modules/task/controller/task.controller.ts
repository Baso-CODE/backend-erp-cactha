import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";

import { getStringParam } from "../../../helpers/request.helper";
import { CreateTaskDTO } from "../dto/create-task.dto";
import { MoveTaskDTO } from "../dto/move-task.dto";
import { QueryTaskActivityDTO } from "../dto/query-task-activity.dto";
import { QueryTaskDTO } from "../dto/query-task.dto";
import { UpdateTaskDTO } from "../dto/update-task.dto";
import { TaskService } from "../service/task.service";

@injectable()
export class TaskController {
  constructor(
    @inject(TaskService)
    private readonly taskService: TaskService,
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const query = (req as any).validatedQuery as QueryTaskDTO;

      const result = await this.taskService.getAll(actorId, query);

      return res.status(200).json({
        success: true,
        message: "Task berhasil diambil",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);

      const data = await this.taskService.getById(id, actorId);

      return res.status(200).json({
        success: true,
        message: "Detail task berhasil diambil",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const dto = req.body as CreateTaskDTO;

      const data = await this.taskService.create(actorId, dto);

      return res.status(201).json({
        success: true,
        message: "Task berhasil dibuat",
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
      const dto = req.body as UpdateTaskDTO;

      const data = await this.taskService.update(id, actorId, dto);

      return res.status(200).json({
        success: true,
        message: "Task berhasil diperbarui",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  move = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const id = getStringParam(req.params.id);
      const dto = req.body as MoveTaskDTO;

      const data = await this.taskService.move(id, actorId, dto);

      return res.status(200).json({
        success: true,
        message: "Posisi task berhasil diperbarui",
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

      const result = await this.taskService.delete(id, actorId);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getActivity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;

      const id = getStringParam(req.params.id);

      const query = (req as any).validatedQuery as QueryTaskActivityDTO;

      const result = await this.taskService.getActivity(
        id,
        actorId,
        query.page,
        query.limit,
      );

      return res.status(200).json({
        success: true,
        message: "Activity task berhasil diambil",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
