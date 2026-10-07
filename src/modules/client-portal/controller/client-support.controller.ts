import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../../helpers/request.helper";
import { ApiError } from "../../../utils/api-error";
import { CreateClientSupportMessageDTO } from "../dto/create-client-support-message.dto";
import { CreateClientSupportDTO } from "../dto/create-client-support.dto";
import { QueryClientSupportDTO } from "../dto/query-client-support.dto";
import { ClientSupportService } from "../services/client-support.service";

@injectable()
export class ClientSupportController {
  constructor(private readonly clientSupportService: ClientSupportService) {}

  getTickets = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const query = (req as any).validatedQuery as QueryClientSupportDTO;

      const result = await this.clientSupportService.getTickets(query, actorId);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };

  getTicketById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const ticketId = getStringParam(req.params.id);

      const data = await this.clientSupportService.getTicketById(
        ticketId,
        actorId,
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createTicket = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const body = req.body as CreateClientSupportDTO;

      const data = await this.clientSupportService.createTicket(body, actorId);

      res.status(201).json({
        success: true,
        message: "Support ticket berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  createMessage = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const ticketId = getStringParam(req.params.id);
      const body = req.body as CreateClientSupportMessageDTO;

      const data = await this.clientSupportService.createMessage(
        ticketId,
        body,
        actorId,
      );

      res.status(201).json({
        success: true,
        message: "Pesan berhasil dikirim.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
