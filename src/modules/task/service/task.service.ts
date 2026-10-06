import { AccessScope, Priority, Prisma, TaskStatus } from "@prisma/client";
import { inject, injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { NotificationService } from "../../notification/notification.service";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskDTO } from "../dto/create-task.dto";
import { MoveTaskDTO } from "../dto/move-task.dto";
import { QueryTaskDTO, SortOrder, TaskSortBy } from "../dto/query-task.dto";
import { UpdateTaskDTO } from "../dto/update-task.dto";

const taskInclude = {
  project: {
    select: {
      id: true,
      projectCode: true,
      name: true,
      projectManagerId: true,
    },
  },
  workflowInstance: {
    select: {
      id: true,
      status: true,
      currentStepKey: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  parentTask: {
    select: {
      id: true,
      taskCode: true,
      title: true,
    },
  },
  _count: {
    select: {
      subtasks: true,
      checklists: true,
      comments: true,
      attachments: true,
    },
  },
} satisfies Prisma.TaskInclude;

const taskDetailInclude = {
  project: {
    select: {
      id: true,
      projectCode: true,
      name: true,
      projectManagerId: true,
    },
  },
  workflowInstance: {
    select: {
      id: true,
      status: true,
      currentStepKey: true,
      workflowTemplateId: true,
    },
  },
  assignee: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  parentTask: {
    select: {
      id: true,
      taskCode: true,
      title: true,
      status: true,
    },
  },
  subtasks: {
    select: {
      id: true,
      taskCode: true,
      title: true,
      status: true,
      priority: true,
      position: true,
      startDate: true,
      dueDate: true,
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          subtasks: true,
          checklists: true,
        },
      },
    },
    orderBy: [
      {
        position: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },
  checklists: {
    orderBy: [
      {
        position: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  },
  comments: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  attachments: true,
  _count: {
    select: {
      subtasks: true,
      checklists: true,
      comments: true,
      attachments: true,
    },
  },
} satisfies Prisma.TaskInclude;

@injectable()
export class TaskService {
  constructor(
    @inject(PrismaService)
    private readonly prisma: PrismaService,

    @inject(AccessScopeService)
    private readonly accessScopeService: AccessScopeService,

    @inject(NotificationService)
    private readonly notificationService: NotificationService,
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

  private async buildAccessWhere(
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
    id: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.buildAccessWhere(actorId, permission);

    const task = await this.prisma.task.findFirst({
      where: {
        id,
        ...accessWhere,
      },
      include: taskInclude,
    });

    if (!task) {
      throw new ApiError("Task tidak ditemukan atau tidak dapat diakses", 404);
    }

    return task;
  }

  private validateDates(startDate?: Date | null, dueDate?: Date | null) {
    if (startDate && dueDate && dueDate < startDate) {
      throw new ApiError("Due date tidak boleh sebelum start date", 400);
    }
  }

  private async validateProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        projectManagerId: true,
        status: true,
      },
    });

    if (!project) {
      throw new ApiError("Project tidak ditemukan", 404);
    }

    return project;
  }

  private async validateWorkflowInstance(
    workflowInstanceId: string,
    projectId: string,
  ) {
    const workflow = await this.prisma.workflowInstance.findUnique({
      where: { id: workflowInstanceId },
      select: {
        id: true,
        projectService: {
          select: {
            projectId: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new ApiError("Workflow instance tidak ditemukan", 404);
    }

    if (workflow.projectService.projectId !== projectId) {
      throw new ApiError(
        "Workflow instance tidak berasal dari project yang sama",
        400,
      );
    }

    return workflow;
  }

  private async validateAssignee(assigneeId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new ApiError("Assignee tidak ditemukan", 404);
    }

    if (!user.isActive) {
      throw new ApiError("Assignee tidak aktif", 400);
    }

    return user;
  }

  private async validateParentTask(
    parentTaskId: string,
    projectId: string,
    currentTaskId?: string,
  ) {
    if (currentTaskId && parentTaskId === currentTaskId) {
      throw new ApiError(
        "Task tidak dapat menjadi parent dirinya sendiri",
        400,
      );
    }

    const parent = await this.prisma.task.findUnique({
      where: { id: parentTaskId },
      select: {
        id: true,
        projectId: true,
        parentTaskId: true,
      },
    });

    if (!parent) {
      throw new ApiError("Parent task tidak ditemukan", 404);
    }

    if (parent.projectId !== projectId) {
      throw new ApiError(
        "Parent task harus berada pada project yang sama",
        400,
      );
    }

    if (currentTaskId) {
      let cursor: string | null = parent.parentTaskId;
      const visited = new Set<string>();

      while (cursor) {
        if (cursor === currentTaskId) {
          throw new ApiError(
            "Relasi parent task akan menyebabkan circular dependency",
            400,
          );
        }

        if (visited.has(cursor)) {
          throw new ApiError(
            "Struktur subtask tidak valid karena terdapat circular dependency",
            400,
          );
        }

        visited.add(cursor);

        const ancestor = await this.prisma.task.findUnique({
          where: { id: cursor },
          select: {
            parentTaskId: true,
          },
        });

        if (!ancestor) {
          break;
        }

        cursor = ancestor.parentTaskId;
      }
    }

    return parent;
  }

  private buildTaskOrderBy(
    sortBy: TaskSortBy,
    sortOrder: SortOrder,
  ): Prisma.TaskOrderByWithRelationInput[] {
    switch (sortBy) {
      case TaskSortBy.DUE_DATE:
        return [{ dueDate: sortOrder }, { createdAt: "desc" }];

      case TaskSortBy.POSITION:
        return [{ position: sortOrder }, { createdAt: "asc" }];

      case TaskSortBy.CREATED_AT:
      default:
        return [{ createdAt: sortOrder }];
    }
  }

  async getAll(actorId: string, query: QueryTaskDTO) {
    const {
      search,
      projectId,
      workflowInstanceId,
      assigneeId,
      parentTaskId,
      status,
      priority,
      sortBy = TaskSortBy.CREATED_AT,
      sortOrder = SortOrder.DESC,
      page = 1,
      limit = 20,
    } = query;

    const accessWhere = await this.buildAccessWhere(actorId, "task.read");

    const where: Prisma.TaskWhereInput = {
      ...accessWhere,

      ...(projectId && {
        projectId,
      }),

      ...(workflowInstanceId && {
        workflowInstanceId,
      }),

      ...(assigneeId && {
        assigneeId,
      }),

      ...(parentTaskId && {
        parentTaskId,
      }),

      ...(status && {
        status,
      }),

      ...(priority && {
        priority,
      }),

      ...(search && {
        OR: [
          {
            taskCode: {
              contains: search,
            },
          },
          {
            title: {
              contains: search,
            },
          },
          {
            description: {
              contains: search,
            },
          },
          {
            project: {
              name: {
                contains: search,
              },
            },
          },
          {
            assignee: {
              name: {
                contains: search,
              },
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    const orderBy = this.buildTaskOrderBy(sortBy, sortOrder);

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy,
        skip,
        take: limit,
      }),

      this.prisma.task.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, actorId: string) {
    const accessWhere = await this.buildAccessWhere(actorId, "task.read");

    const task = await this.prisma.task.findFirst({
      where: {
        id,
        ...accessWhere,
      },
      include: taskDetailInclude,
    });

    if (!task) {
      throw new ApiError("Task tidak ditemukan atau tidak dapat diakses", 404);
    }

    return task;
  }

  async create(actorId: string, dto: CreateTaskDTO) {
    const project = await this.validateProject(dto.projectId);

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "task.create",
    );

    if (scope === AccessScope.OWN && project.projectManagerId !== actorId) {
      throw new ApiError("Anda tidak dapat membuat task pada project ini", 403);
    }

    if (dto.workflowInstanceId) {
      await this.validateWorkflowInstance(
        dto.workflowInstanceId,
        dto.projectId,
      );
    }

    if (dto.assigneeId) {
      await this.validateAssignee(dto.assigneeId);

      if (dto.assigneeId !== actorId) {
        await this.accessScopeService.getPermissionScope(
          actorId,
          "task.assign",
        );
      }
    }

    if (dto.parentTaskId) {
      await this.validateParentTask(dto.parentTaskId, dto.projectId);
    }

    this.validateDates(dto.startDate, dto.dueDate);

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "TASK",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "TASK",
          value: 1,
        },
      });

      const taskCode = `TASK-${String(counter.value).padStart(6, "0")}`;

      const lastTask = await tx.task.findFirst({
        where: {
          projectId: dto.projectId,
          status: dto.status ?? TaskStatus.TODO,
        },
        orderBy: {
          position: "desc",
        },
        select: {
          position: true,
        },
      });

      const position = (lastTask?.position ?? 0) + 1024;

      const task = await tx.task.create({
        data: {
          taskCode,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          projectId: dto.projectId,
          workflowInstanceId: dto.workflowInstanceId ?? null,
          assigneeId: dto.assigneeId ?? null,
          parentTaskId: dto.parentTaskId ?? null,
          priority: dto.priority ?? Priority.MEDIUM,
          status: dto.status ?? TaskStatus.TODO,
          position,
          startDate: dto.startDate ?? null,
          dueDate: dto.dueDate ?? null,
        },
        include: taskInclude,
      });

      if (task.assigneeId && task.assigneeId !== actorId) {
        await this.notificationService.create(
          {
            recipientId: task.assigneeId,
            type: "TASK_ASSIGNED",
            title: "Task baru ditugaskan",
            message: `Anda ditugaskan ke ${task.taskCode} - ${task.title}`,
            entity: "Task",
            entityId: task.id,
            actionUrl: "/internal/tasks",
            metadata: {
              taskCode: task.taskCode,
              projectId: task.projectId,
            },
          },
          tx,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Task",
          entityId: task.id,
          details: {
            taskCode: task.taskCode,
            title: task.title,
            projectId: task.projectId,
            assigneeId: task.assigneeId,
          },
        },
      });

      return task;
    });
  }

  async update(id: string, actorId: string, dto: UpdateTaskDTO) {
    const task = await this.getAccessibleTask(id, actorId, "task.update");

    if (
      dto.workflowInstanceId !== undefined &&
      dto.workflowInstanceId !== null
    ) {
      await this.validateWorkflowInstance(
        dto.workflowInstanceId,
        task.projectId,
      );
    }

    if (dto.assigneeId !== undefined && dto.assigneeId !== task.assigneeId) {
      await this.accessScopeService.getPermissionScope(actorId, "task.assign");

      if (dto.assigneeId !== null) {
        await this.validateAssignee(dto.assigneeId);
      }
    }

    if (dto.parentTaskId !== undefined && dto.parentTaskId !== null) {
      await this.validateParentTask(dto.parentTaskId, task.projectId, task.id);
    }

    this.validateDates(
      dto.startDate !== undefined ? dto.startDate : task.startDate,
      dto.dueDate !== undefined ? dto.dueDate : task.dueDate,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.task.update({
        where: {
          id,
        },
        data: {
          ...(dto.title !== undefined && {
            title: dto.title.trim(),
          }),
          ...(dto.description !== undefined && {
            description: dto.description.trim() || null,
          }),
          ...(dto.workflowInstanceId !== undefined && {
            workflowInstanceId: dto.workflowInstanceId,
          }),
          ...(dto.assigneeId !== undefined && {
            assigneeId: dto.assigneeId,
          }),
          ...(dto.parentTaskId !== undefined && {
            parentTaskId: dto.parentTaskId,
          }),
          ...(dto.priority !== undefined && {
            priority: dto.priority,
          }),
          ...(dto.status !== undefined && {
            status: dto.status,
          }),
          ...(dto.position !== undefined && {
            position: dto.position,
          }),
          ...(dto.startDate !== undefined && {
            startDate: dto.startDate,
          }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate,
          }),
        },
        include: taskInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Task",
          entityId: id,
          details: {
            type: "TASK_UPDATE",
            before: {
              title: task.title,
              description: task.description,
              workflowInstanceId: task.workflowInstanceId,
              assigneeId: task.assigneeId,
              assigneeName: task.assignee?.name ?? null,
              parentTaskId: task.parentTaskId,
              parentTaskTitle: task.parentTask?.title ?? null,
              priority: task.priority,
              status: task.status,
              position: task.position,
              startDate: task.startDate?.toISOString() ?? null,
              dueDate: task.dueDate?.toISOString() ?? null,
            },
            after: {
              title: updated.title,
              description: updated.description,
              workflowInstanceId: updated.workflowInstanceId,
              assigneeId: updated.assigneeId,
              assigneeName: updated.assignee?.name ?? null,
              parentTaskId: updated.parentTaskId,
              parentTaskTitle: updated.parentTask?.title ?? null,
              priority: updated.priority,
              status: updated.status,
              position: updated.position,
              startDate: updated.startDate?.toISOString() ?? null,
              dueDate: updated.dueDate?.toISOString() ?? null,
            },
          },
        },
      });

      if (
        updated.assigneeId &&
        updated.assigneeId !== task.assigneeId &&
        updated.assigneeId !== actorId
      ) {
        await this.notificationService.create(
          {
            recipientId: updated.assigneeId,
            type: "TASK_ASSIGNED",
            title: "Task ditugaskan kepada Anda",
            message: `Anda ditugaskan ke ${updated.taskCode} - ${updated.title}`,
            entity: "Task",
            entityId: updated.id,
            actionUrl: "/internal/tasks",
            metadata: {
              taskCode: updated.taskCode,
              projectId: updated.projectId,
            },
          },
          tx,
        );
      }

      if (
        updated.status !== task.status &&
        updated.assigneeId &&
        updated.assigneeId !== actorId
      ) {
        await this.notificationService.create(
          {
            recipientId: updated.assigneeId,
            type: "TASK_STATUS_CHANGED",
            title: "Status task berubah",
            message: `${updated.taskCode} berubah dari ${task.status} menjadi ${updated.status}`,
            entity: "Task",
            entityId: updated.id,
            actionUrl: "/internal/tasks",
            metadata: {
              taskCode: updated.taskCode,
              fromStatus: task.status,
              toStatus: updated.status,
            },
          },
          tx,
        );
      }

      return updated;
    });
  }

  async move(id: string, actorId: string, dto: MoveTaskDTO) {
    const currentTask = await this.getAccessibleTask(
      id,
      actorId,
      "task.manage",
    );

    if (dto.beforeTaskId === id || dto.afterTaskId === id) {
      throw new ApiError(
        "Task tidak dapat dijadikan referensi posisi dirinya sendiri",
        400,
      );
    }

    const [beforeTask, afterTask] = await Promise.all([
      dto.beforeTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.beforeTaskId,
            },
            select: {
              id: true,
              projectId: true,
              status: true,
              position: true,
            },
          })
        : null,

      dto.afterTaskId
        ? this.prisma.task.findUnique({
            where: {
              id: dto.afterTaskId,
            },
            select: {
              id: true,
              projectId: true,
              status: true,
              position: true,
            },
          })
        : null,
    ]);

    for (const referenceTask of [beforeTask, afterTask]) {
      if (!referenceTask) continue;

      if (referenceTask.projectId !== currentTask.projectId) {
        throw new ApiError(
          "Task referensi harus berasal dari project yang sama",
          400,
        );
      }

      if (referenceTask.status !== dto.status) {
        throw new ApiError(
          "Task referensi harus berada pada status tujuan yang sama",
          400,
        );
      }
    }

    if (beforeTask && afterTask && beforeTask.position >= afterTask.position) {
      throw new ApiError("Urutan beforeTask dan afterTask tidak valid", 400);
    }

    let position: number;

    if (beforeTask && afterTask) {
      position = (beforeTask.position + afterTask.position) / 2;
    } else if (beforeTask) {
      const nextTask = await this.prisma.task.findFirst({
        where: {
          projectId: currentTask.projectId,
          status: dto.status,
          id: {
            not: id,
          },
          position: {
            gt: beforeTask.position,
          },
        },
        orderBy: {
          position: "asc",
        },
        select: {
          position: true,
        },
      });

      position = nextTask
        ? (beforeTask.position + nextTask.position) / 2
        : beforeTask.position + 1024;
    } else if (afterTask) {
      const previousTask = await this.prisma.task.findFirst({
        where: {
          projectId: currentTask.projectId,
          status: dto.status,
          id: {
            not: id,
          },
          position: {
            lt: afterTask.position,
          },
        },
        orderBy: {
          position: "desc",
        },
        select: {
          position: true,
        },
      });

      position = previousTask
        ? (previousTask.position + afterTask.position) / 2
        : afterTask.position - 1024;
    } else {
      const lastTask = await this.prisma.task.findFirst({
        where: {
          projectId: currentTask.projectId,
          status: dto.status,
          id: {
            not: id,
          },
        },
        orderBy: {
          position: "desc",
        },
        select: {
          position: true,
        },
      });

      position = (lastTask?.position ?? 0) + 1024;
    }

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: {
          id,
        },
        data: {
          status: dto.status,
          position,
        },
        include: taskInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "MOVE",
          entity: "Task",
          entityId: task.id,
          details: {
            fromStatus: currentTask.status,
            toStatus: dto.status,
            beforeTaskId: dto.beforeTaskId ?? null,
            afterTaskId: dto.afterTaskId ?? null,
            position,
          },
        },
      });

      if (
        task.status !== currentTask.status &&
        task.assigneeId &&
        task.assigneeId !== actorId
      ) {
        await this.notificationService.create(
          {
            recipientId: task.assigneeId,
            type: "TASK_STATUS_CHANGED",
            title: "Status task berubah",
            message: `${task.taskCode} berubah dari ${currentTask.status} menjadi ${task.status}`,
            entity: "Task",
            entityId: task.id,
            actionUrl: "/internal/tasks",
            metadata: {
              taskCode: task.taskCode,
              fromStatus: currentTask.status,
              toStatus: task.status,
            },
          },
          tx,
        );
      }

      return task;
    });
  }

  async getActivity(id: string, actorId: string, page = 1, limit = 20) {
    await this.getAccessibleTask(id, actorId, "task.read");

    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      entity: "Task",
      entityId: id,
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          action: true,
          entity: true,
          entityId: true,
          details: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      this.prisma.auditLog.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async delete(id: string, actorId: string) {
    const task = await this.getAccessibleTask(id, actorId, "task.delete");

    if (task._count.subtasks > 0) {
      throw new ApiError(
        "Task yang masih memiliki subtask tidak dapat dihapus",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Task",
          entityId: task.id,
          details: {
            taskCode: task.taskCode,
            title: task.title,
          },
        },
      });

      await tx.task.delete({
        where: { id },
      });

      return {
        message: "Task berhasil dihapus",
      };
    });
  }
}
