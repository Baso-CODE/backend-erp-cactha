import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";

import { CreateSupportReplyDTO } from "./dto/create-support-reply.dto";
import { QuerySupportTicketDTO } from "./dto/query-support-ticket.dto";
import { UpdateSupportTicketDTO } from "./dto/update-support-ticket.dto";
import { SupportTicketService } from "./support-ticket.service";

@injectable()
export class SupportTicketController {
  constructor(private readonly service: SupportTicketService) {}

  private actorId(req: Request): string {
    const id = (req as any).user?.id;

    if (typeof id !== "string" || !id) {
      throw new ApiError("User tidak terautentikasi.", 401);
    }

    return id;
  }

  private ticketId(req: Request): string {
    const id = getStringParam(req.params.id);

    if (!isUUID(id, "4")) {
      throw new ApiError("Ticket ID tidak valid.", 400);
    }

    return id;
  }

  getAll = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const query = (req as any).validatedQuery as QuerySupportTicketDTO;

      const result = await this.service.getAll(query, this.actorId(req));

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
      const data = await this.service.getById(
        this.ticketId(req),
        this.actorId(req),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  update = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.update(
        this.ticketId(req),
        req.body as UpdateSupportTicketDTO,
        this.actorId(req),
      );

      res.status(200).json({
        success: true,
        message: "Support ticket berhasil diperbarui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  reply = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const body = req.body as CreateSupportReplyDTO;

      const data = await this.service.reply(
        this.ticketId(req),
        body.message,
        this.actorId(req),
      );

      res.status(201).json({
        success: true,
        message: "Balasan berhasil dikirim.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
