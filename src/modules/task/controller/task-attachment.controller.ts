import { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { getStringParam } from "../../../helpers/request.helper";
import { TaskAttachmentService } from "../service/task-attachment.service";

@injectable()
export class TaskAttachmentController {
  constructor(
    @inject(TaskAttachmentService)
    private readonly taskAttachmentService: TaskAttachmentService,
  ) {}

  getAll = async (req: Request, res: Response) => {
    const taskId = getStringParam(req.params.taskId);
    const actorId = (req as any).user.id;

    const data = await this.taskAttachmentService.getAll(taskId, actorId);

    res.status(200).json({
      success: true,
      data,
    });
  };

  create = async (req: Request, res: Response) => {
    const taskId = getStringParam(req.params.taskId);
    const actorId = (req as any).user.id;

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: "File wajib diupload",
      });
      return;
    }

    const data = await this.taskAttachmentService.create(
      taskId,
      actorId,
      req.file,
    );

    res.status(201).json({
      success: true,
      message: "Attachment berhasil diupload",
      data,
    });
  };

  delete = async (req: Request, res: Response) => {
    const id = getStringParam(req.params.id);
    const actorId = (req as any).user.id;

    const data = await this.taskAttachmentService.delete(id, actorId);

    res.status(200).json({
      success: true,
      ...data,
    });
  };
}
