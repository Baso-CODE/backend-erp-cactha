import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { getStringParam } from "../../../helpers/request.helper";
import { ApiError } from "../../../utils/api-error";
import { RequestClientRevisionDTO } from "../dto/request-client-revision.dto";
import { ClientApprovalService } from "../services/client-approval.service";

@injectable()
export class ClientApprovalController {
  constructor(private readonly clientApprovalService: ClientApprovalService) {}

  getApprovals = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const data = await this.clientApprovalService.getApprovals(actorId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const approvalId = getStringParam(req.params.id);

      const data = await this.clientApprovalService.approve(
        approvalId,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Deliverable berhasil disetujui.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  requestRevision = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const approvalId = getStringParam(req.params.id);
      const body = req.body as RequestClientRevisionDTO;

      const data = await this.clientApprovalService.requestRevision(
        approvalId,
        body.feedback,
        actorId,
      );

      res.status(200).json({
        success: true,
        message: "Permintaan revisi berhasil dikirim.",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
