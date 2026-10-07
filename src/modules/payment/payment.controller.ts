import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { CreatePaymentDTO } from "./dto/create-payment.dto";
import { QueryPaymentDTO } from "./dto/query-payment.dto";
import { RejectPaymentDTO } from "./dto/reject-payment.dto";
import { UpdatePaymentDTO } from "./dto/update-payment.dto";
import { PaymentService } from "./payment.service";

@injectable()
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  getAllPayments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const query = (req as any).validatedQuery as QueryPaymentDTO;

      const result = await this.paymentService.getAllPayments(query, user.id);

      res.status(200).json({
        success: true,
        message: "Daftar payment berhasil diambil.",
        ...result,
      });
    } catch (error) {
      next(error);
    }
  };

  getPaymentById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const payment = await this.paymentService.getPaymentById(id, user.id);

      res.status(200).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  };

  createPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = (req as any).user;
      const data = req.body as CreatePaymentDTO;

      const payment = await this.paymentService.createPayment(data, user.id);

      res.status(201).json({
        success: true,
        message: "Payment berhasil dibuat.",
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  };

  updatePayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = req.body as UpdatePaymentDTO;

      const payment = await this.paymentService.updatePayment(
        id,
        data,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Payment berhasil diperbarui.",
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;

      const result = await this.paymentService.verifyPayment(id, user.id);

      res.status(200).json({
        success: true,
        message: "Payment berhasil diverifikasi.",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  rejectPayment = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = getStringParam(req.params.id);
      const user = (req as any).user;
      const data = req.body as RejectPaymentDTO;

      const payment = await this.paymentService.rejectPayment(
        id,
        data,
        user.id,
      );

      res.status(200).json({
        success: true,
        message: "Payment berhasil ditolak.",
        data: payment,
      });
    } catch (error) {
      next(error);
    }
  };
}
