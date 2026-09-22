import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../helpers/request.helper";
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

      const result = await this.quotationService.getAllQuotations(
        req.query as any,
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
}
