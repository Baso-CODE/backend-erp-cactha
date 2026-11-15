import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";

import { getStringParam } from "../../helpers/request.helper";
import { ApiError } from "../../utils/api-error";
import { DeliverableFileService } from "./deliverable-file.service";

@injectable()
export class DeliverableFileController {
  constructor(private readonly service: DeliverableFileService) {}

  private actor(req: Request): string {
    const id = (req as any).user?.id;

    if (!id) {
      throw new ApiError("Tidak terautentikasi.", 401);
    }

    return id;
  }

  private id(req: Request): string {
    const id = getStringParam(req.params.id);

    if (!isUUID(id, "4")) {
      throw new ApiError("Deliverable ID tidak valid.", 400);
    }

    return id;
  }

  upload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.file) {
        throw new ApiError("File wajib diupload.", 400);
      }

      const data = await this.service.upload(
        this.id(req),
        this.actor(req),
        req.file,
      );

      res.status(201).json({
        success: true,
        message: "File berhasil diupload.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  internalDownload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.getInternalDownload(
        this.id(req),
        this.actor(req),
      );

      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  clientDownload = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.getClientDownload(
        this.id(req),
        this.actor(req),
      );

      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };
}
