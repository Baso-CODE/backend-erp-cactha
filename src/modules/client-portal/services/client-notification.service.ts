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

  private getWhere(
    actorId: string,
    clientId: string,
  ): Prisma.NotificationWhereInput {
    return {
      recipientId: actorId,

      OR: [
        {
          type: {
            in: CLIENT_NOTIFICATION_TYPES,
          },
        },

        // Hanya SYSTEM notification khusus Support Ticket client.
        // SYSTEM notification untuk tim internal tetap tersembunyi.
        {
          type: NotificationType.SYSTEM,
          entity: "SupportTicket",
          AND: [
            {
              metadata: {
                path: ["audience"],
                equals: "CLIENT",
              },
            },
            {
              metadata: {
                path: ["clientId"],
                equals: clientId,
              },
            },
          ],
        },
      ],
    };
  }

  async getAll(
    actorId: string,
    query: {
      page?: number;
      limit?: number;
      isRead?: boolean;
    },
  ) {
    const context = await this.access.getClientContext(actorId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const baseWhere = this.getWhere(actorId, context.clientId);

    const where: Prisma.NotificationWhereInput = {
      AND: [
        baseWhere,
        ...(query.isRead !== undefined ? [{ isRead: query.isRead }] : []),
      ],
    };

    const [notifications, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          entityId: true,
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          readAt: true,
          createdAt: true,
        },
      }),

      this.prisma.notification.count({
        where,
      }),

      this.prisma.notification.count({
        where: {
          AND: [baseWhere, { isRead: false }],
        },
      }),
    ]);

    return {
      data: notifications.map(({ entityId, ...item }) => ({
        ...item,
        actionUrl:
          item.type === NotificationType.SYSTEM && entityId
            ? `/portal/support/${encodeURIComponent(entityId)}`
            : item.type === NotificationType.PROJECT_UPDATED
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
    const context = await this.access.getClientContext(actorId);

    const where: Prisma.NotificationWhereInput = {
      id: notificationId,
      AND: [this.getWhere(actorId, context.clientId)],
    };

    const result = await this.prisma.notification.updateMany({
      where: {
        AND: [where, { isRead: false }],
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.notification.findFirst({
        where,
        select: {
          id: true,
        },
      });

      if (!existing) {
        throw new ApiError(
          "Notifikasi tidak ditemukan atau akses ditolak.",
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
    const context = await this.access.getClientContext(actorId);

    const result = await this.prisma.notification.updateMany({
      where: {
        AND: [this.getWhere(actorId, context.clientId), { isRead: false }],
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
