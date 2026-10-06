import { plainToInstance } from "class-transformer";
import { validateOrReject } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { QueryLeadDTO } from "./dto/query-lead.dto";
import { LeadService } from "./lead.service";

@injectable()
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  getAllLeads = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const query = plainToInstance(QueryLeadDTO, req.query);

      await validateOrReject(query);

      const result = await this.leadService.getAllLeads(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar lead berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getLeadById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const lead = await this.leadService.getLeadById(id, user.id);

      res.status(200).json({
        success: true,
        data: lead,
      });
    } catch (error) {
      next(error);
    }
  };

  createLead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const lead = await this.leadService.createLead(req.body, user.id);

      res.status(201).json({
        success: true,
        message: "Lead berhasil dibuat.",
        data: lead,
      });
    } catch (error) {
      next(error);
    }
  };

  updateLead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const lead = await this.leadService.updateLead(id, req.body, user.id);

      res.status(200).json({
        success: true,
        message: "Lead berhasil diperbarui.",
        data: lead,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteLead = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const result = await this.leadService.deleteLead(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getLeadMetrics = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const metrics = await this.leadService.getLeadMetrics(user.id);

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  };
}
