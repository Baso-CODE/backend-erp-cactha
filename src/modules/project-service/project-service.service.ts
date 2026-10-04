import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectServiceDTO } from "./dto/create-project-service.dto";
import { QueryProjectServiceDTO } from "./dto/query-project-service.dto";
import { UpdateProjectServiceDTO } from "./dto/update-project-service.dto";

type WorkflowStep = {
  key: string;
  name: string;
  order: number;
};

@injectable()
export class ProjectServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async getProjectAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.ProjectWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope === "ALL") {
      return {};
    }

    if (scope === "OWN") {
      return {
        projectManagerId: actorId,
      };
    }

    throw new ApiError("Scope akses project service belum didukung.", 403);
  }

  private async getAccessibleProject(
    projectId: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.getProjectAccessWhere(actorId, permission);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...accessWhere,
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        clientId: true,
        projectManagerId: true,
      },
    });

    if (!project) {
      throw new ApiError(
        "Project tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return project;
  }

  private async getAccessibleProjectService(
    id: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.getProjectAccessWhere(actorId, permission);

    const projectService = await this.prisma.projectService.findFirst({
      where: {
        id,
        project: accessWhere,
      },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
            projectManagerId: true,
          },
        },
        masterService: {
          include: {
            defaultTemplate: true,
          },
        },
        workflowInstance: true,
      },
    });

    if (!projectService) {
      throw new ApiError(
        "Project service tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return projectService;
  }

  private async validateMasterService(masterServiceId: string) {
    const masterService = await this.prisma.masterService.findUnique({
      where: {
        id: masterServiceId,
      },
      include: {
        defaultTemplate: true,
      },
    });

    if (!masterService) {
      throw new ApiError("Master service tidak ditemukan.", 404);
    }

    if (!masterService.isActive) {
      throw new ApiError("Master service tidak aktif.", 400);
    }

    return masterService;
  }

  private validateDates(startDate?: Date | null, endDate?: Date | null): void {
    if (startDate && endDate && endDate <= startDate) {
      throw new ApiError("End date harus setelah start date.", 400);
    }
  }

  private normalizeWorkflowSteps(steps: Prisma.JsonValue): WorkflowStep[] {
    if (!Array.isArray(steps)) {
      throw new ApiError("Workflow template steps tidak valid.", 500);
    }

    const normalized = steps
      .map((step) => {
        if (typeof step !== "object" || step === null || Array.isArray(step)) {
          throw new ApiError("Workflow template step tidak valid.", 500);
        }

        const value = step as Record<string, Prisma.JsonValue>;

        if (
          typeof value.key !== "string" ||
          typeof value.name !== "string" ||
          typeof value.order !== "number"
        ) {
          throw new ApiError("Workflow template step tidak valid.", 500);
        }

        return {
          key: value.key,
          name: value.name,
          order: value.order,
        };
      })
      .sort((a, b) => a.order - b.order);

    if (normalized.length === 0) {
      throw new ApiError("Workflow template belum memiliki step.", 400);
    }

    return normalized;
  }

  async getProjectServices(query: QueryProjectServiceDTO, actorId: string) {
    const accessWhere = await this.getProjectAccessWhere(
      actorId,
      "project.service.read",
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectServiceWhereInput = {
      project: accessWhere,
    };

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    if (query.masterServiceId) {
      where.masterServiceId = query.masterServiceId;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.projectService.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              projectManagerId: true,
            },
          },
          masterService: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              isActive: true,
            },
          },
          workflowInstance: {
            select: {
              id: true,
              status: true,
              currentStepKey: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      }),
      this.prisma.projectService.count({
        where,
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProjectServiceById(id: string, actorId: string) {
    return this.getAccessibleProjectService(
      id,
      actorId,
      "project.service.read",
    );
  }

  async createProjectService(data: CreateProjectServiceDTO, actorId: string) {
    await this.getAccessibleProject(
      data.projectId,
      actorId,
      "project.service.create",
    );

    const masterService = await this.validateMasterService(
      data.masterServiceId,
    );

    this.validateDates(data.startDate, data.endDate);

    const existing = await this.prisma.projectService.findUnique({
      where: {
        projectId_masterServiceId: {
          projectId: data.projectId,
          masterServiceId: data.masterServiceId,
        },
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ApiError("Service ini sudah ditambahkan ke project.", 409);
    }

    return this.prisma.$transaction(async (tx) => {
      const projectService = await tx.projectService.create({
        data: {
          projectId: data.projectId,
          masterServiceId: data.masterServiceId,
          startDate: data.startDate ?? null,
          endDate: data.endDate ?? null,
        },
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          masterService: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });

      let workflowInstance = null;

      if (masterService.defaultTemplate) {
        const steps = this.normalizeWorkflowSteps(
          masterService.defaultTemplate.steps,
        );

        workflowInstance = await tx.workflowInstance.create({
          data: {
            workflowTemplateId: masterService.defaultTemplate.id,
            projectServiceId: projectService.id,
            status: "RUNNING",
            currentStepKey: steps[0].key,
            stepsSnapshot: steps as Prisma.InputJsonValue,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "ProjectService",
          entityId: projectService.id,
          details: {
            after: {
              projectService,
              workflowInstance,
            },
          },
        },
      });

      return {
        ...projectService,
        workflowInstance,
      };
    });
  }

  async updateProjectService(
    id: string,
    data: UpdateProjectServiceDTO,
    actorId: string,
  ) {
    const existing = await this.getAccessibleProjectService(
      id,
      actorId,
      "project.service.update",
    );

    const targetStartDate =
      data.startDate === undefined ? existing.startDate : data.startDate;

    const targetEndDate =
      data.endDate === undefined ? existing.endDate : data.endDate;

    this.validateDates(targetStartDate, targetEndDate);

    return this.prisma.$transaction(async (tx) => {
      const projectService = await tx.projectService.update({
        where: { id },
        data: {
          ...(data.startDate !== undefined && {
            startDate: data.startDate,
          }),
          ...(data.endDate !== undefined && {
            endDate: data.endDate,
          }),
        },
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          masterService: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          workflowInstance: {
            select: {
              id: true,
              status: true,
              currentStepKey: true,
              startedAt: true,
              completedAt: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "ProjectService",
          entityId: id,
          details: {
            before: existing,
            after: projectService,
          },
        },
      });

      return projectService;
    });
  }

  async deleteProjectService(id: string, actorId: string) {
    const existing = await this.getAccessibleProjectService(
      id,
      actorId,
      "project.service.delete",
    );

    if (
      existing.workflowInstance &&
      existing.workflowInstance.status === "RUNNING"
    ) {
      throw new ApiError(
        "Project service tidak dapat dihapus karena workflow masih berjalan.",
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.projectService.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "ProjectService",
          entityId: id,
          details: {
            before: existing,
          },
        },
      });
    });

    return {
      message: "Project service berhasil dihapus.",
    };
  }
}
