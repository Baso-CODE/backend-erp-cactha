import cron from "node-cron";
import { container } from "tsyringe";
import { NotificationService } from "../modules/notification/notification.service";

export function initializeNotificationCron(): void {
  cron.schedule("0 * * * *", async () => {
    try {
      const notificationService = container.resolve(NotificationService);

      const result = await notificationService.createTaskDueSoonNotifications();

      console.log(
        `[CRON][TASK_DUE_SOON] checked=${result.checked} created=${result.created}`,
      );
    } catch (error) {
      console.error("[CRON][TASK_DUE_SOON] gagal:", error);
    }
  });

  cron.schedule("0 2 * * *", async () => {
    try {
      const notificationService = container.resolve(NotificationService);

      const result = await notificationService.cleanupOldNotifications();

      console.log(`[CRON][NOTIFICATION_CLEANUP] deleted=${result.deleted}`);
    } catch (error) {
      console.error("[CRON][NOTIFICATION_CLEANUP] gagal:", error);
    }
  });
}
