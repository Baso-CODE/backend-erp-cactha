import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { ClientProfileService } from "../services/client-profile.service";

@injectable()
export class ClientProfileController {
  constructor(private readonly clientProfileService: ClientProfileService) {}

  getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const data = await this.clientProfileService.getProfile(actorId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
