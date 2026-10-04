import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreateWorkflowTemplateDTO } from "./dto/create-workflow-template.dto";
import { QueryWorkflowTemplateDTO } from "./dto/query-workflow-template.dto";
import { UpdateWorkflowTemplateDTO } from "./dto/update-workflow-template.dto";
import { WorkflowTemplateService } from "./workflow-template.service";

@injectable()
export class WorkflowTemplateController {
  constructor(
    private readonly workflowTemplateService: WorkflowTemplateService,
  ) {}

  getWorkflowTemplates = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const query = (req as any).validatedQuery as QueryWorkflowTemplateDTO;

      const result = await this.workflowTemplateService.getWorkflowTemplates(
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Workflow template berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getWorkflowTemplateById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const data = await this.workflowTemplateService.getWorkflowTemplateById(
        id,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Detail workflow template berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createWorkflowTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const payload = req.body as CreateWorkflowTemplateDTO;

      const data = await this.workflowTemplateService.createWorkflowTemplate(
        payload,
        actorId,
      );

      res.status(201).json({
        success: true,
        message: "Workflow template berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateWorkflowTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);
      const payload = req.body as UpdateWorkflowTemplateDTO;

      const data = await this.workflowTemplateService.updateWorkflowTemplate(
        id,
        payload,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Workflow template berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteWorkflowTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user.userId;
      const id = getStringParam(req.params.id);

      const result = await this.workflowTemplateService.deleteWorkflowTemplate(
        id,
        actorId,
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
