import { AccessScope, Prisma } from "@prisma/client";
import { inject, injectable } from "tsyringe";

import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { NotificationService } from "../../notification/notification.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskCommentDTO } from "../dto/create-task-comment.dto";
import { UpdateTaskCommentDTO } from "../dto/update-task-comment.dto";

const commentInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} satisfies Prisma.TaskCommentInclude;

@injectable()
export class TaskCommentService {
  constructor(
    @inject(PrismaService)
    private readonly prisma: PrismaService,

    @inject(AccessScopeService)
    private readonly accessScopeService: AccessScopeService,

    @inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {}

  private async buildAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};

      case AccessScope.TEAM: {
        const teamMemberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return {
          assigneeId: {
            in: teamMemberIds,
          },
        };
      }

      case AccessScope.PROJECT:
        return {
          project: {
            projectManagerId: actorId,
          },
        };

      case AccessScope.OWN:
        return {
          assigneeId: actorId,
        };

      case AccessScope.CLIENT:
      default:
        throw new ApiError(
          `Scope ${scope} belum didukung untuk resource Task`,
          403,
        );
    }
  }

  private async getAccessibleTask(
    taskId: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.buildAccessWhere(actorId, permission);

    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        ...accessWhere,
      },
      select: {
        id: true,
        taskCode: true,
        title: true,
        projectId: true,
        assigneeId: true,
        project: {
          select: {
            projectManagerId: true,
          },
        },
      },
    });

    if (!task) {
      throw new ApiError("Task tidak ditemukan atau tidak dapat diakses", 404);
    }

    return task;
  }

  private async getCommentForMutation(
    id: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const comment = await this.prisma.taskComment.findUnique({
      where: { id },
      include: {
        ...commentInclude,
        task: {
          select: {
            id: true,
            projectId: true,
            assigneeId: true,
            project: {
              select: {
                projectManagerId: true,
              },
            },
          },
        },
      },
    });

    if (!comment) {
      throw new ApiError("Komentar tidak ditemukan", 404);
    }

    if (scope === AccessScope.ALL) {
      return comment;
    }

    if (comment.userId !== actorId) {
      throw new ApiError(
        "Anda hanya dapat mengubah atau menghapus komentar sendiri",
        403,
      );
    }

    return comment;
  }

  async getAll(taskId: string, actorId: string) {
    await this.getAccessibleTask(taskId, actorId, "task.read");

    return this.prisma.taskComment.findMany({
      where: {
        taskId,
      },
      include: commentInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  }

  async create(taskId: string, actorId: string, dto: CreateTaskCommentDTO) {
    const task = await this.getAccessibleTask(
      taskId,
      actorId,
      "task.comment.create",
    );

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.create({
        data: {
          taskId,
          userId: actorId,
          comment: dto.comment.trim(),
        },
        include: commentInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "COMMENT_CREATE",
          entity: "Task",
          entityId: taskId,
          details: {
            type: "COMMENT",
            commentId: comment.id,
            comment: comment.comment,
          },
        },
      });

      const recipients = new Set<string>();

      if (task.assigneeId && task.assigneeId !== actorId) {
        recipients.add(task.assigneeId);
      }

      if (
        task.project.projectManagerId &&
        task.project.projectManagerId !== actorId
      ) {
        recipients.add(task.project.projectManagerId);
      }

      for (const recipientId of recipients) {
        await this.notificationService.create(
          {
            recipientId,
            type: "TASK_COMMENTED",
            title: "Komentar baru pada task",
            message: `${comment.user.name} mengomentari ${task.taskCode} - ${task.title}`,
            entity: "Task",
            entityId: task.id,
            actionUrl: "/internal/tasks",
            metadata: {
              taskCode: task.taskCode,
              projectId: task.projectId,
              commentId: comment.id,
              commenterId: actorId,
            },
          },
          tx,
        );
      }

      return comment;
    });
  }
  async update(id: string, actorId: string, dto: UpdateTaskCommentDTO) {
    const existing = await this.getCommentForMutation(
      id,
      actorId,
      "task.comment.update",
    );

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.update({
        where: {
          id,
        },
        data: {
          comment: dto.comment.trim(),
        },
        include: commentInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "COMMENT_UPDATE",
          entity: "Task",
          entityId: comment.taskId,
          details: {
            type: "COMMENT",
            commentId: comment.id,
            before: {
              comment: existing.comment,
            },
            after: {
              comment: comment.comment,
            },
          },
        },
      });

      return comment;
    });
  }

  async delete(id: string, actorId: string) {
    const comment = await this.getCommentForMutation(
      id,
      actorId,
      "task.comment.delete",
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "COMMENT_DELETE",
          entity: "Task",
          entityId: comment.taskId,
          details: {
            type: "COMMENT",
            commentId: comment.id,
            comment: comment.comment,
          },
        },
      });

      await tx.taskComment.delete({
        where: {
          id,
        },
      });

      return {
        message: "Komentar berhasil dihapus",
      };
    });
  }
}
