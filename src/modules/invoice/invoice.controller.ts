import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreateInvoiceDTO } from "./dto/create-invoice.dto";
import { QueryInvoiceDTO } from "./dto/query-invoice.dto";
import { UpdateInvoiceDTO } from "./dto/update-invoice.dto";
import { InvoiceService } from "./invoice.service";

@injectable()
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  getAllInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryInvoiceDTO;

      const result = await this.invoiceService.getAllInvoices(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar invoice berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getInvoiceById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const invoice = await this.invoiceService.getInvoiceById(id, user.id);

      res.status(200).json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  createInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = req.body as CreateInvoiceDTO;

      const invoice = await this.invoiceService.createInvoice(data, user.id);

      res.status(201).json({
        success: true,
        message: "Invoice berhasil dibuat.",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  updateInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = req.body as UpdateInvoiceDTO;

      const invoice = await this.invoiceService.updateInvoice(
        id,
        data,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Invoice berhasil diperbarui.",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  sendInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const invoice = await this.invoiceService.sendInvoice(id, user.id);

      res.status(200).json({
        success: true,
        message: "Invoice berhasil dikirim.",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  cancelInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const invoice = await this.invoiceService.cancelInvoice(id, user.id);

      res.status(200).json({
        success: true,
        message: "Invoice berhasil dibatalkan.",
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);

      const user = (req as any).user;

      const result = await this.invoiceService.deleteInvoice(id, user.id);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };
}
