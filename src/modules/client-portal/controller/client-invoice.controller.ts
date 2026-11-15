import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { QueryClientInvoiceDTO } from "../dto/query-client-invoice.dto";
import { ClientInvoiceService } from "../services/client-invoice.service";

@injectable()
export class ClientInvoiceController {
  constructor(private readonly service: ClientInvoiceService) {}

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const query = (req as any).validatedQuery as QueryClientInvoiceDTO;

      const result = await this.service.getAll(query, actorId);

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;
      const invoiceId = req.params.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      if (typeof invoiceId !== "string" || !isUUID(invoiceId, "4")) {
        throw new ApiError("Invoice ID tidak valid.", 400);
      }

      const data = await this.service.getById(invoiceId, actorId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
