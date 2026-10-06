import { AccessScope, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskChecklistDTO } from "../dto/create-task-checklist.dto";
import { UpdateTaskChecklistDTO } from "../dto/update-task-checklist.dto";

@injectable()
export class TaskChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
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
      },
    });

    if (!task) {
      throw new ApiError("Task tidak ditemukan atau tidak dapat diakses", 404);
    }

    return task;
  }

  private async getAccessibleChecklist(
    id: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.buildAccessWhere(actorId, permission);

    const checklist = await this.prisma.taskChecklist.findFirst({
      where: {
        id,
        task: accessWhere,
      },
      include: {
        task: {
          select: {
            id: true,
            taskCode: true,
            title: true,
          },
        },
      },
    });

    if (!checklist) {
      throw new ApiError(
        "Checklist tidak ditemukan atau tidak dapat diakses",
        404,
      );
    }

    return checklist;
  }

  async getAll(taskId: string, actorId: string) {
    await this.getAccessibleTask(taskId, actorId, "task.read");

    return this.prisma.taskChecklist.findMany({
      where: {
        taskId,
      },
      orderBy: [
        {
          position: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });
  }

  async create(taskId: string, actorId: string, dto: CreateTaskChecklistDTO) {
    await this.getAccessibleTask(taskId, actorId, "task.checklist.create");

    return this.prisma.$transaction(async (tx) => {
      let position = dto.position;

      if (position === undefined) {
        const lastChecklist = await tx.taskChecklist.findFirst({
          where: {
            taskId,
          },
          orderBy: {
            position: "desc",
          },
          select: {
            position: true,
          },
        });

        position = (lastChecklist?.position ?? 0) + 1;
      }

      const checklist = await tx.taskChecklist.create({
        data: {
          taskId,
          description: dto.description.trim(),
          position,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CHECKLIST_CREATE",
          entity: "Task",
          entityId: taskId,
          details: {
            type: "CHECKLIST",
            checklistId: checklist.id,
            description: checklist.description,
            isCompleted: checklist.isCompleted,
            position: checklist.position,
          },
        },
      });

      return checklist;
    });
  }

  async update(id: string, actorId: string, dto: UpdateTaskChecklistDTO) {
    const existing = await this.getAccessibleChecklist(
      id,
      actorId,
      "task.checklist.update",
    );

    return this.prisma.$transaction(async (tx) => {
      const checklist = await tx.taskChecklist.update({
        where: {
          id,
        },
        data: {
          ...(dto.description !== undefined && {
            description: dto.description.trim(),
          }),

          ...(dto.isCompleted !== undefined && {
            isCompleted: dto.isCompleted,
          }),

          ...(dto.position !== undefined && {
            position: dto.position,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CHECKLIST_UPDATE",
          entity: "Task",
          entityId: existing.taskId,
          details: {
            type: "CHECKLIST",
            checklistId: checklist.id,

            before: {
              description: existing.description,
              isCompleted: existing.isCompleted,
              position: existing.position,
            },

            after: {
              description: checklist.description,
              isCompleted: checklist.isCompleted,
              position: checklist.position,
            },
          },
        },
      });

      return checklist;
    });
  }

  async delete(id: string, actorId: string) {
    const checklist = await this.getAccessibleChecklist(
      id,
      actorId,
      "task.checklist.delete",
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CHECKLIST_DELETE",
          entity: "Task",
          entityId: checklist.taskId,
          details: {
            type: "CHECKLIST",
            checklistId: checklist.id,
            description: checklist.description,
            isCompleted: checklist.isCompleted,
            position: checklist.position,
          },
        },
      });

      await tx.taskChecklist.delete({
        where: {
          id,
        },
      });

      return {
        message: "Checklist berhasil dihapus",
      };
    });
  }
}
