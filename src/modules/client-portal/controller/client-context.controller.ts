import { NextFunction, Request, Response } from "express";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { ClientPortalAccessService } from "../services/client-portal-access.service";

@injectable()
export class ClientContextController {
  constructor(
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  getContext = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const actorId = (req as any).user?.id;

      if (!actorId) {
        throw new ApiError("User tidak terautentikasi.", 401);
      }

      const context =
        await this.clientPortalAccessService.getClientContext(actorId);

      res.status(200).json({
        success: true,
        data: {
          userId: context.userId,
          contact: {
            id: context.contactId,
            name: context.contactName,
            email: context.contactEmail,
            isPrimary: context.isPrimaryContact,
          },
          client: {
            id: context.client.id,
            clientCode: context.client.clientCode,
            companyName: context.client.companyName,
            status: context.client.status,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
