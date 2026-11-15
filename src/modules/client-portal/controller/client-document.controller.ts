import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../../helpers/request.helper";
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

  getDownloadUrl = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const documentId = getStringParam(req.params.id);

      if (!isUUID(documentId, "4")) {
        throw new ApiError("Document ID tidak valid.", 400);
      }

      const data = await this.clientDocumentService.getDownloadUrl(
        documentId,
        actorId,
      );

      res.setHeader("Cache-Control", "private, no-store");

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
