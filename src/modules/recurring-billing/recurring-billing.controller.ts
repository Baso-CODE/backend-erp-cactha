import { RecurringBillingJobStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";
import {
  CreateRecurringBillingDTO,
  QueryRecurringBillingDTO,
  UpdateRecurringBillingDTO,
} from "./dto/recurring-billing.dto";
import { RecurringBillingJobMonitorService } from "./services/recurring-billing-job-monitor.service";
import { RecurringBillingService } from "./services/recurring-billing.service";

@injectable()
export class RecurringBillingController {
  constructor(
    private readonly recurringBillingService: RecurringBillingService,
    private readonly jobMonitorService: RecurringBillingJobMonitorService,
  ) {}

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryRecurringBillingDTO;
      const result = await this.recurringBillingService.getAll(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar recurring billing berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const result = await this.recurringBillingService.getById(id, user.id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = req.body as CreateRecurringBillingDTO;
      const result = await this.recurringBillingService.create(data, user.id);

      res.status(201).json({
        success: true,
        message: "Recurring billing berhasil dibuat.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const result = await this.recurringBillingService.update(
        id,
        req.body as UpdateRecurringBillingDTO,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Recurring billing berhasil diperbarui.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  activate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const result = await this.recurringBillingService.setActive(
        id,
        true,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Recurring billing berhasil diaktifkan.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const result = await this.recurringBillingService.setActive(
        id,
        false,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Recurring billing berhasil dinonaktifkan.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  generateInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const invoice = await this.recurringBillingService.generateInvoice(
        id,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Invoice recurring billing berhasil dibuat.",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  getJobSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await this.jobMonitorService.getSummary(user.id);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getJobs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const page = Number(req.query.page ?? 1);
      const limit = Number(req.query.limit ?? 10);
      const status = req.query.status;
      const recurringBillingId = req.query.recurringBillingId;

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

      const allowedStatuses: RecurringBillingJobStatus[] = [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "FAILED",
      ];

      if (
        status !== undefined &&
        (typeof status !== "string" ||
          !allowedStatuses.includes(status as RecurringBillingJobStatus))
      ) {
        throw new ApiError("Status job tidak valid.", 400);
      }

      if (
        recurringBillingId !== undefined &&
        (typeof recurringBillingId !== "string" || !recurringBillingId.trim())
      ) {
        throw new ApiError("Recurring billing ID tidak valid.", 400);
      }

      const result = await this.jobMonitorService.getJobs(
        {
          page,
          limit,
          ...(status && {
            status: status as RecurringBillingJobStatus,
          }),
          ...(recurringBillingId && { recurringBillingId }),
        },
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Daftar recurring billing job berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  retryJob = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const jobId = getStringParam(req.params.jobId);
      const user = (req as any).user;

      const result = await this.jobMonitorService.retryJob(jobId, user.id);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
