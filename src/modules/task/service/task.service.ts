import { AccessScope, Priority, Prisma, TaskStatus } from "@prisma/client";
import { inject, injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateTaskDTO } from "../dto/create-task.dto";
import { MoveTaskDTO } from "../dto/move-task.dto";
import { QueryTaskDTO } from "../dto/query-task.dto";
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

@injectable()
export class TaskService {
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

    if (currentTaskId && parent.parentTaskId === currentTaskId) {
      throw new ApiError(
        "Relasi parent task akan menyebabkan circular dependency",
        400,
      );
    }

    return parent;
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
      page = 1,
      limit = 20,
    } = query;

    const accessWhere = await this.buildAccessWhere(actorId, "task.read");

    const where: Prisma.TaskWhereInput = {
      ...accessWhere,
      ...(projectId && { projectId }),
      ...(workflowInstanceId && {
        workflowInstanceId,
      }),
      ...(assigneeId && { assigneeId }),
      ...(parentTaskId && { parentTaskId }),
      ...(status && { status }),
      ...(priority && { priority }),
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

    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [
          { status: "asc" },
          { position: "asc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
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

  async getById(id: string, actorId: string) {
    return this.getAccessibleTask(id, actorId, "task.read");
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
        const assignScope = await this.accessScopeService.getPermissionScope(
          actorId,
          "task.assign",
        );

        if (!assignScope) {
          throw new ApiError(
            "Anda tidak memiliki permission untuk assign task",
            403,
          );
        }
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

      const position = (lastTask?.position ?? 0) + 1;

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
        where: { id },
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
          details: dto as Prisma.InputJsonValue,
        },
      });

      return updated;
    });
  }

  async move(id: string, actorId: string, dto: MoveTaskDTO) {
    await this.getAccessibleTask(id, actorId, "task.manage");

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          status: dto.status,
          position: dto.position,
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
            status: dto.status,
            position: dto.position,
          },
        },
      });

      return task;
    });
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
