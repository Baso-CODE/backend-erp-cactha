import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
import {
  CreateRecurringBillingDTO,
  QueryRecurringBillingDTO,
  UpdateRecurringBillingDTO,
} from "./dto/recurring-billing.dto";
import { RecurringBillingService } from "./recurring-billing.service";

@injectable()
export class RecurringBillingController {
  constructor(
    private readonly recurringBillingService: RecurringBillingService,
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
}
