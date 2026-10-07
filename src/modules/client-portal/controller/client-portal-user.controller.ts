import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ClientPortalUserService } from "../services/client-portal-user.service";

@injectable()
export class ClientPortalUserController {
  constructor(
    private readonly clientPortalUserService: ClientPortalUserService,
  ) {}

  getOptions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const currentUserId =
        typeof req.query.currentUserId === "string"
          ? req.query.currentUserId
          : undefined;

      const data = await this.clientPortalUserService.getOptions(currentUserId);

      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
