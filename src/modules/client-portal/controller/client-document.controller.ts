import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { QueryClientDocumentDTO } from "../dto/query-client-document.dto";
import { ClientDocumentService } from "../services/client-document.service";

@injectable()
export class ClientDocumentController {
  constructor(private readonly clientDocumentService: ClientDocumentService) {}

  getDocuments = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const query = (req as any).validatedQuery as QueryClientDocumentDTO;

      const result = await this.clientDocumentService.getDocuments(
        query,
        actorId,
      );

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  };
}
