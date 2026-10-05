import { NextFunction, Request, Response } from "express";
import { inject, injectable } from "tsyringe";

import { getStringParam } from "../../../helpers/request.helper";
import { CreateTaskCommentDTO } from "../dto/create-task-comment.dto";
import { UpdateTaskCommentDTO } from "../dto/update-task-comment.dto";
import { TaskCommentService } from "../service/task-comment.service";

@injectable()
export class TaskCommentController {
  constructor(
    @inject(TaskCommentService)
    private readonly taskCommentService: TaskCommentService,
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorId = (req as any).user.id;
      const taskId = getStringParam(req.params.taskId);

      const data = await this.taskCommentService.getAll(taskId, actorId);

      return res.status(200).json({
        success: true,
        message: "Komentar task berhasil diambil",
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
      const dto = req.body as CreateTaskCommentDTO;

      const data = await this.taskCommentService.create(taskId, actorId, dto);

      return res.status(201).json({
        success: true,
        message: "Komentar berhasil ditambahkan",
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
      const dto = req.body as UpdateTaskCommentDTO;

      const data = await this.taskCommentService.update(id, actorId, dto);

      return res.status(200).json({
        success: true,
        message: "Komentar berhasil diperbarui",
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

      const result = await this.taskCommentService.delete(id, actorId);

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
