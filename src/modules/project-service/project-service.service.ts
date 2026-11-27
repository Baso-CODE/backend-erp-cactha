import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { ImportContractServicesDTO } from "../project/dto/import-contract-services.dto";
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
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const accessWhere = await this.getProjectAccessWhere(actorId, permission);

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        ...accessWhere,
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        clientId: true,
        contractId: true,
        projectManagerId: true,
        status: true,
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

            category: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                sortOrder: true,
              },
            },
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

  private async validateMasterService(
    masterServiceId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const masterService = await db.masterService.findUnique({
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
      throw new ApiError(
        `Master service "${masterService.name}" tidak aktif.`,
        400,
      );
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
              categoryId: true,

              category: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  isActive: true,
                  sortOrder: true,
                },
              },
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

    return this.prisma.$transaction(async (tx) => {
      await this.lockProject(tx, data.projectId);

      await this.getAccessibleProject(
        data.projectId,
        actorId,
        "project.service.create",
        tx,
      );

      return this.createServiceInTransaction(tx, data, actorId);
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
              description: true,
              isActive: true,
              categoryId: true,

              category: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  isActive: true,
                  sortOrder: true,
                },
              },
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

  async getAvailableMasterServices(projectId: string, actorId: string) {
    await this.getAccessibleProject(
      projectId,
      actorId,
      "project.service.create",
    );

    return this.prisma.masterService.findMany({
      where: {
        isActive: true,

        projectServices: {
          none: {
            projectId,
          },
        },
      },

      select: {
        id: true,
        code: true,
        name: true,

        category: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            sortOrder: true,
          },
        },

        defaultTemplate: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },

      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async getContractHandoff(
    projectId: string,
    contractId: string,
    actorId: string,
  ) {
    const project = await this.getAccessibleProject(
      projectId,
      actorId,
      "project.service.create",
    );

    return this.buildContractHandoff(this.prisma, project, contractId);
  }

  async importContractServices(
    projectId: string,
    contractId: string,
    input: ImportContractServicesDTO,
    actorId: string,
  ) {
    await this.getAccessibleProject(
      projectId,
      actorId,
      "project.service.create",
    );

    return this.prisma.$transaction(
      async (tx) => {
        // Mencegah import dan penambahan manual bersamaan.
        await this.lockProject(tx, projectId);

        const project = await this.getAccessibleProject(
          projectId,
          actorId,
          "project.service.create",
          tx,
        );

        if (project.contractId !== contractId) {
          throw new ApiError("Contract sumber project sudah berubah.", 409);
        }

        // Pertahankan status contract selama proses import.
        await tx.$queryRaw`
        SELECT "id"
        FROM "Contract"
        WHERE "id" = ${contractId}
        FOR SHARE
      `;

        const handoff = await this.buildContractHandoff(
          tx,
          project,
          contractId,
        );

        if (!handoff.canImport) {
          throw new ApiError(
            "Import membutuhkan contract Active dan project yang belum Completed atau Cancelled.",
            409,
          );
        }

        const itemMap = new Map(
          handoff.items.map((item) => [item.masterServiceId, item]),
        );

        const requestedIds = [...new Set(input.masterServiceIds)];

        const selectedItems = requestedIds.map((masterServiceId) => {
          const item = itemMap.get(masterServiceId);

          if (!item) {
            throw new ApiError(
              "Terdapat layanan yang tidak tercantum dalam contract ini.",
              400,
            );
          }

          if (item.availability === "INACTIVE") {
            throw new ApiError(
              `Service "${item.serviceNameSnapshot}" sudah tidak aktif.`,
              409,
            );
          }

          return item;
        });

        const alreadyAdded = selectedItems.filter(
          (item) => item.availability === "ALREADY_ADDED",
        ).length;

        const availableItems = selectedItems.filter(
          (item) => item.availability === "AVAILABLE",
        );

        const createdIds: string[] = [];
        let workflowCreated = 0;

        for (const item of availableItems) {
          const result = await this.createServiceInTransaction(
            tx,
            {
              projectId,
              masterServiceId: item.masterServiceId,
            },
            actorId,
            contractId,
          );

          createdIds.push(result.id);

          if (result.workflowInstance) {
            workflowCreated++;
          }
        }

        return {
          projectId,
          contractId,

          requestedCount: requestedIds.length,
          createdCount: createdIds.length,
          skippedCount: alreadyAdded,
          workflowCreated,
          createdIds,
        };
      },
      {
        timeout: 30000,
      },
    );
  }

  private async lockProject(tx: Prisma.TransactionClient, projectId: string) {
    await tx.$queryRaw`
    SELECT "id"
    FROM "Project"
    WHERE "id" = ${projectId}
    FOR UPDATE
  `;
  }

  private async createServiceInTransaction(
    tx: Prisma.TransactionClient,
    data: CreateProjectServiceDTO,
    actorId: string,
    sourceContractId?: string,
  ) {
    const masterService = await this.validateMasterService(
      data.masterServiceId,
      tx,
    );

    this.validateDates(data.startDate, data.endDate);

    const existing = await tx.projectService.findUnique({
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
            description: true,
            isActive: true,
            categoryId: true,

            category: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                sortOrder: true,
              },
            },
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
          source: sourceContractId ? "CONTRACT_HANDOFF" : "MANUAL",

          sourceContractId: sourceContractId ?? null,

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
  }

  private async buildContractHandoff(
    db: Prisma.TransactionClient,
    project: {
      id: string;
      clientId: string;
      contractId: string | null;
      status: string;
    },
    expectedContractId: string,
  ) {
    if (!project.contractId || project.contractId !== expectedContractId) {
      throw new ApiError(
        "Contract sumber project sudah berubah atau tidak tersedia.",
        409,
      );
    }

    const contract = await db.contract.findFirst({
      where: {
        id: expectedContractId,
        clientId: project.clientId,
      },

      select: {
        id: true,
        contractNo: true,
        title: true,
        status: true,

        serviceItems: {
          orderBy: [
            { categorySortOrderSnapshot: "asc" },
            { serviceNameSnapshot: "asc" },
            { id: "asc" },
          ],

          select: {
            id: true,
            masterServiceId: true,

            serviceCodeSnapshot: true,
            serviceNameSnapshot: true,
            serviceDescriptionSnapshot: true,

            categoryIdSnapshot: true,
            categoryCodeSnapshot: true,
            categoryNameSnapshot: true,
            categorySortOrderSnapshot: true,

            masterService: {
              select: {
                id: true,
                name: true,
                isActive: true,

                defaultTemplate: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      throw new ApiError(
        "Contract tidak ditemukan atau bukan milik client project ini.",
        404,
      );
    }

    const existingServices = await db.projectService.findMany({
      where: {
        projectId: project.id,
      },
      select: {
        masterServiceId: true,
      },
    });

    const existingIds = new Set(
      existingServices.map((item) => item.masterServiceId),
    );

    const canImport =
      contract.status === "ACTIVE" &&
      !["COMPLETED", "CANCELLED"].includes(project.status);

    const items = contract.serviceItems.map(
      ({ masterService, ...snapshot }) => ({
        ...snapshot,

        currentServiceName: masterService.name,

        workflowTemplate: masterService.defaultTemplate,

        availability: existingIds.has(snapshot.masterServiceId)
          ? ("ALREADY_ADDED" as const)
          : !masterService.isActive
            ? ("INACTIVE" as const)
            : ("AVAILABLE" as const),
      }),
    );

    return {
      contract: {
        id: contract.id,
        contractNo: contract.contractNo,
        title: contract.title,
        status: contract.status,
      },

      canImport,

      items,

      summary: {
        total: items.length,

        available: items.filter((item) => item.availability === "AVAILABLE")
          .length,

        alreadyAdded: items.filter(
          (item) => item.availability === "ALREADY_ADDED",
        ).length,

        inactive: items.filter((item) => item.availability === "INACTIVE")
          .length,
      },
    };
  }
}
