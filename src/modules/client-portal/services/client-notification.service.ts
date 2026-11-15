import { NotificationType, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ClientPortalAccessService } from "./client-portal-access.service";

const CLIENT_NOTIFICATION_TYPES: NotificationType[] = [
  NotificationType.PROJECT_UPDATED,
  NotificationType.DELIVERABLE_READY,
  NotificationType.APPROVAL_REQUESTED,
];

@injectable()
export class ClientNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClientPortalAccessService,
  ) {}

  private getWhere(actorId: string): Prisma.NotificationWhereInput {
    return {
      recipientId: actorId,
      type: {
        in: CLIENT_NOTIFICATION_TYPES,
      },
    };
  }

  private async checkAccess(actorId: string) {
    return this.access.getClientContext(actorId);
  }

  async getAll(
    actorId: string,
    query: {
      page?: number;
      limit?: number;
      isRead?: boolean;
    },
  ) {
    await this.checkAccess(actorId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.NotificationWhereInput = {
      ...this.getWhere(actorId),
      ...(query.isRead !== undefined && {
        isRead: query.isRead,
      }),
    };

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),

      this.prisma.notification.count({ where }),

      this.prisma.notification.count({
        where: {
          ...this.getWhere(actorId),
          isRead: false,
        },
      }),
    ]);

    return {
      data: notifications.map((item) => ({
        ...item,
        // Jangan mengekspos actionUrl/metadata internal.
        actionUrl:
          item.type === NotificationType.PROJECT_UPDATED
            ? "/portal/projects"
            : "/portal/approvals",
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async markAsRead(notificationId: string, actorId: string) {
    await this.checkAccess(actorId);

    const result = await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        ...this.getWhere(actorId),
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          id: notificationId,
          ...this.getWhere(actorId),
        },
        select: { id: true },
      });

      if (!existing) {
        throw new ApiError(
          "Notifikasi tidak ditemukan atau tidak dapat diakses.",
          404,
        );
      }
    }

    return {
      id: notificationId,
      success: true,
    };
  }

  async markAllAsRead(actorId: string) {
    await this.checkAccess(actorId);

    const result = await this.prisma.notification.updateMany({
      where: {
        ...this.getWhere(actorId),
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      updatedCount: result.count,
    };
  }
}
