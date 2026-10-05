import { AccessScope, Prisma } from "@prisma/client";
import { inject, injectable } from "tsyringe";

import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
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
  ) {}

  private async getActorRoleCodes(actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: {
        roles: {
          select: {
            role: {
              select: {
                code: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new ApiError("User tidak ditemukan", 404);
    }

    return user.roles.map((item) => item.role.code);
  }

  private async buildTaskAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.TaskWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope === AccessScope.ALL) {
      return {};
    }

    const roles = await this.getActorRoleCodes(actorId);

    if (roles.includes("PROJECT_MANAGER")) {
      return {
        project: {
          projectManagerId: actorId,
        },
      };
    }

    return {
      assigneeId: actorId,
    };
  }

  private async getAccessibleTask(
    taskId: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.buildTaskAccessWhere(actorId, permission);

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
    await this.getAccessibleTask(taskId, actorId, "task.comment.create");

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
          action: "CREATE",
          entity: "TaskComment",
          entityId: comment.id,
          details: {
            taskId,
          },
        },
      });

      return comment;
    });
  }

  async update(id: string, actorId: string, dto: UpdateTaskCommentDTO) {
    await this.getCommentForMutation(id, actorId, "task.comment.update");

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.taskComment.update({
        where: { id },
        data: {
          comment: dto.comment.trim(),
        },
        include: commentInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "TaskComment",
          entityId: id,
          details: {
            taskId: comment.taskId,
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
          action: "DELETE",
          entity: "TaskComment",
          entityId: comment.id,
          details: {
            taskId: comment.taskId,
          },
        },
      });

      await tx.taskComment.delete({
        where: { id },
      });

      return {
        message: "Komentar berhasil dihapus",
      };
    });
  }
}
