import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";
import { QueryQuotationDTO } from "./dto/query-quotation.dto";
import { QuotationService } from "./quotation.service";

@injectable()
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}

  getAllQuotations = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryQuotationDTO;

      const result = await this.quotationService.getAllQuotations(
        query,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Daftar quotation berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getQuotationById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const quotation = await this.quotationService.getQuotationById(
        id,
        user.id,
      );

      res.status(200).json({
        success: true,
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  };

  createQuotation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;

      const quotation = await this.quotationService.createQuotation(
        req.body,
        user.id,
      );

      res.status(201).json({
        success: true,
        message: "Quotation berhasil dibuat.",
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  };

  updateQuotation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const quotation = await this.quotationService.updateQuotation(
        id,
        req.body,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Quotation berhasil diperbarui.",
        data: quotation,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteQuotation = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const id = getStringParam(req.params.id);

      const result = await this.quotationService.deleteQuotation(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getCreateServiceOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const leadId = getStringParam(req.params.leadId);

      if (!isUUID(leadId, "4")) {
        throw new ApiError("Lead ID tidak valid.", 400);
      }

      const data = await this.quotationService.getCreateServiceOptions(
        leadId,
        (req as any).user.id,
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getEditServiceOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      if (!isUUID(id, "4")) {
        throw new ApiError("Quotation ID tidak valid.", 400);
      }

      const data = await this.quotationService.getEditServiceOptions(
        id,
        (req as any).user.id,
      );

      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
