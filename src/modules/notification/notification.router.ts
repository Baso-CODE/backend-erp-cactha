import { Router } from "express";
import { injectable } from "tsyringe";
import { authenticateToken } from "../../middleware/auth.middleware";
import { validateQuery } from "../../middleware/validateQuery.middleware";
import { QueryNotificationDTO } from "./dto/query-notification.dto";
import { NotificationController } from "./notification.controller";

@injectable()
export class NotificationRouter {
  private readonly router: Router = Router();

  constructor(private readonly notificationController: NotificationController) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.use(authenticateToken);

    this.router.get(
      "/",
      validateQuery(QueryNotificationDTO),
      this.notificationController.getAll,
    );

    this.router.patch("/read-all", this.notificationController.markAllAsRead);

    this.router.patch("/:id/read", this.notificationController.markAsRead);
  };

  getRouter(): Router {
    return this.router;
  }
}
