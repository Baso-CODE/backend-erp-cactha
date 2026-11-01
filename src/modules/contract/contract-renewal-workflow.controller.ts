import { isUUID } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../utils/api-error";
import { ContractRenewalWorkflowService } from "./contract-renewal-workflow.service";
import { CreateContractRenewalDTO } from "./dto/contract-renewal.dto";

@injectable()
export class ContractRenewalWorkflowController {
  constructor(private readonly service: ContractRenewalWorkflowService) {}

  private getId(req: Request): string {
    const id = String(req.params.id ?? "");

    if (!isUUID(id, "4")) {
      throw new ApiError("Contract ID tidak valid.", 400);
    }

    return id;
  }

  private getActorId(req: Request): string {
    const id = (req as any).user?.id;

    if (typeof id !== "string" || !id) {
      throw new ApiError("Autentikasi tidak valid.", 401);
    }

    return id;
  }

  createDraft = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.createDraft(
        this.getId(req),
        req.body as CreateContractRenewalDTO,
        this.getActorId(req),
      );

      res.status(201).json({
        success: true,
        message: "Draft renewal berhasil dibuat.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.getHistory(
        this.getId(req),
        this.getActorId(req),
      );

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  activateRenewal = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.service.activateRenewal(
        this.getId(req),
        this.getActorId(req),
      );

      res.status(200).json({
        success: true,
        message: "Kontrak renewal berhasil diaktifkan.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
