import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
import {
  CreateProjectBudgetDTO,
  QueryProjectBudgetDTO,
  UpdateProjectBudgetDTO,
} from "./dto/project-budget.dto";
import {
  CreateProjectCostDTO,
  QueryProjectCostDTO,
  UpdateProjectCostDTO,
} from "./dto/project-cost.dto";
import { QueryProjectProfitabilityDTO } from "./dto/query-project-profitability.dto";
import { SaveRevenueAllocationsDTO } from "./dto/revenue-allocation.dto";
import { ProfitabilityService } from "./profitability.service";

@injectable()
export class ProfitabilityController {
  constructor(private readonly service: ProfitabilityService) {}

  getBudgets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryProjectBudgetDTO;
      const result = await this.service.getBudgets(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar budget berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getBudgetById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.getBudgetById(id, user.id);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await this.service.createBudget(
        req.body as CreateProjectBudgetDTO,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Budget berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.updateBudget(
        id,
        req.body as UpdateProjectBudgetDTO,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Budget berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteBudget = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.deleteBudget(id, user.id);

      res.status(200).json({
        success: true,
        message: "Budget berhasil dihapus.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getCosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryProjectCostDTO;
      const result = await this.service.getCosts(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar biaya aktual berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getCostById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.getCostById(id, user.id);

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createCost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const data = await this.service.createCost(
        req.body as CreateProjectCostDTO,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Biaya aktual berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.updateCost(
        id,
        req.body as UpdateProjectCostDTO,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Biaya aktual berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = await this.service.deleteCost(id, user.id);

      res.status(200).json({
        success: true,
        message: "Biaya aktual berhasil dihapus.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getProjectProfitability = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const projectId = getStringParam(req.params.projectId);
      const user = (req as any).user;

      const data = await this.service.getProjectProfitability(
        projectId,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Profitability project berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getProjectServiceProfitability = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const projectId = getStringParam(req.params.projectId);
      const user = (req as any).user;

      const data = await this.service.getProjectServiceProfitability(
        projectId,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Budget vs Actual per Service berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getProjectsProfitability = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryProjectProfitabilityDTO;

      const result = await this.service.getProjectsProfitability(
        query,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Ringkasan profitability berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getInvoiceAllocations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const invoiceId = getStringParam(req.params.invoiceId);
      const user = (req as any).user;

      const data = await this.service.getInvoiceAllocations(invoiceId, user.id);

      res.status(200).json({
        success: true,
        message: "Revenue allocation berhasil diambil.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  saveInvoiceAllocations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const invoiceId = getStringParam(req.params.invoiceId);
      const user = (req as any).user;

      const data = await this.service.saveInvoiceAllocations(
        invoiceId,
        req.body as SaveRevenueAllocationsDTO,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Revenue allocation berhasil disimpan.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
