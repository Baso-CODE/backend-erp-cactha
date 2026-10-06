import { NotificationType, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { QueryNotificationDTO } from "./dto/query-notification.dto";

interface CreateNotificationInput {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  entity?: string;
  entityId?: string;
  actionUrl?: string;
  metadata?: Prisma.InputJsonValue;
}

@injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? this.prisma;

    return db.notification.create({
      data: {
        recipientId: data.recipientId,
        type: data.type,
        title: data.title,
        message: data.message,
        entity: data.entity ?? null,
        entityId: data.entityId ?? null,
        actionUrl: data.actionUrl ?? null,
        metadata: data.metadata,
      },
    });
  }

  async getAll(recipientId: string, query: QueryNotificationDTO) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      recipientId,
      ...(query.isRead !== undefined && {
        isRead: query.isRead,
      }),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({
        where,
      }),
      this.prisma.notification.count({
        where: {
          recipientId,
          isRead: false,
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        unreadCount,
      },
    };
  }

  async markAsRead(id: string, recipientId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id,
        recipientId,
      },
    });

    if (!notification) {
      throw new ApiError("Notification tidak ditemukan", 404);
    }

    if (notification.isRead) {
      return notification;
    }

    return this.prisma.notification.update({
      where: {
        id,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(recipientId: string) {
    await this.prisma.notification.updateMany({
      where: {
        recipientId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return {
      message: "Semua notification berhasil ditandai sudah dibaca",
    };
  }

  async createTaskDueSoonNotifications() {
    const now = new Date();

    const threshold = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const tasks = await this.prisma.task.findMany({
      where: {
        assigneeId: {
          not: null,
        },
        dueDate: {
          gt: now,
          lte: threshold,
        },
        status: {
          not: "COMPLETED",
        },
      },
      select: {
        id: true,
        taskCode: true,
        title: true,
        projectId: true,
        assigneeId: true,
        dueDate: true,
      },
    });

    let created = 0;

    for (const task of tasks) {
      if (!task.assigneeId || !task.dueDate) continue;

      const existing = await this.prisma.notification.findFirst({
        where: {
          recipientId: task.assigneeId,
          type: "TASK_DUE_SOON",
          entity: "Task",
          entityId: task.id,
          isRead: false,
        },
        select: {
          id: true,
        },
      });

      if (existing) continue;

      await this.prisma.notification.create({
        data: {
          recipientId: task.assigneeId,
          type: "TASK_DUE_SOON",
          title: "Deadline task mendekat",
          message: `${task.taskCode} - ${task.title} akan segera jatuh tempo`,
          entity: "Task",
          entityId: task.id,
          actionUrl: "/internal/tasks",
          metadata: {
            taskCode: task.taskCode,
            projectId: task.projectId,
            dueDate: task.dueDate.toISOString(),
          },
        },
      });

      created++;
    }

    return {
      checked: tasks.length,
      created,
    };
  }

  async cleanupOldNotifications(retentionDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.prisma.notification.deleteMany({
      where: {
        isRead: true,
        readAt: {
          lt: cutoffDate,
        },
      },
    });

    return {
      deleted: result.count,
    };
  }
}
