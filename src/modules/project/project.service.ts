import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { UserEligibilityService } from "../rbac/user-eligibility.service";
import { CreateProjectDTO } from "./dto/create-project.dto";
import { QueryProjectDTO } from "./dto/query-project.dto";
import { UpdateProjectDTO } from "./dto/update-project.dto";

@injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly userEligibilityService: UserEligibilityService,
  ) {}

  private async getAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.ProjectWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    switch (scope) {
      case "ALL":
        return {};

      case "TEAM": {
        const teamMemberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return {
          projectManagerId: {
            in: teamMemberIds,
          },
        };
      }

      case "OWN":
        return {
          projectManagerId: actorId,
        };

      case "PROJECT":
        return {
          projectManagerId: actorId,
        };

      case "CLIENT":
      default:
        throw new ApiError(
          `Scope ${scope} belum didukung untuk resource Project`,
          403,
        );
    }
  }

  private async getAccessibleProject(
    id: string,
    actorId: string,
    permission: string,
  ) {
    const accessWhere = await this.getAccessWhere(actorId, permission);

    const project = await this.prisma.project.findFirst({
      where: {
        id,
        ...accessWhere,
      },
      include: {
        client: true,
        contract: true,
        projectManager: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            services: true,
            tasks: true,
            deliverables: true,
            performanceMetrics: true,
          },
        },
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

  private async validateClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!client) {
      throw new ApiError("Client tidak ditemukan.", 404);
    }

    if (client.status !== "ACTIVE") {
      throw new ApiError("Client tidak aktif.", 400);
    }
  }

  private async validateContract(
    contractId: string | null | undefined,
    clientId: string,
  ): Promise<void> {
    if (!contractId) return;

    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!contract) {
      throw new ApiError("Contract tidak ditemukan.", 404);
    }

    if (contract.clientId !== clientId) {
      throw new ApiError(
        "Contract tidak terhubung dengan client yang dipilih.",
        400,
      );
    }
  }

  private async validateProjectManager(
    projectManagerId: string,
  ): Promise<void> {
    await this.userEligibilityService.validateUserEligibility(
      projectManagerId,
      {
        permissions: ["project.read", "project.update"],
      },
    );
  }

  private validateDates(
    startDate: Date,
    targetEndDate: Date,
    actualEndDate?: Date | null,
  ): void {
    if (targetEndDate <= startDate) {
      throw new ApiError("Target end date harus setelah start date.", 400);
    }

    if (actualEndDate && actualEndDate < startDate) {
      throw new ApiError(
        "Actual end date tidak boleh sebelum start date.",
        400,
      );
    }
  }

  private async validateAssignPermission(
    actorId: string,
    projectManagerId: string,
  ): Promise<void> {
    if (actorId === projectManagerId) return;

    await this.accessScopeService.getPermissionScope(actorId, "project.assign");
  }

  private async generateProjectCode(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const counter = await tx.counter.upsert({
      where: {
        key: "PROJECT",
      },
      create: {
        key: "PROJECT",
        value: 1,
      },
      update: {
        value: {
          increment: 1,
        },
      },
    });

    return `PROJECT-${String(counter.value).padStart(6, "0")}`;
  }

  async getProjects(query: QueryProjectDTO, actorId: string) {
    const accessWhere = await this.getAccessWhere(actorId, "project.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      ...accessWhere,
    };

    if (query.search) {
      where.OR = [
        {
          projectCode: {
            contains: query.search,
          },
        },
        {
          name: {
            contains: query.search,
          },
        },
        {
          projectType: {
            contains: query.search,
          },
        },
        {
          client: {
            companyName: {
              contains: query.search,
            },
          },
        },
      ];
    }

    if (query.clientId) {
      where.clientId = query.clientId;
    }

    if (query.contractId) {
      where.contractId = query.contractId;
    }

    if (query.projectManagerId) {
      where.projectManagerId = query.projectManagerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
              title: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              services: true,
              tasks: true,
              deliverables: true,
              performanceMetrics: true,
            },
          },
        },
      }),
      this.prisma.project.count({
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

  async getProjectById(id: string, actorId: string) {
    return this.getAccessibleProject(id, actorId, "project.read");
  }

  async createProject(data: CreateProjectDTO, actorId: string) {
    await this.accessScopeService.getPermissionScope(actorId, "project.create");

    await this.validateClient(data.clientId);
    await this.validateContract(data.contractId, data.clientId);
    await this.validateProjectManager(data.projectManagerId);
    await this.validateAssignPermission(actorId, data.projectManagerId);

    this.validateDates(data.startDate, data.targetEndDate);

    return this.prisma.$transaction(async (tx) => {
      const projectCode = await this.generateProjectCode(tx);

      const project = await tx.project.create({
        data: {
          projectCode,
          name: data.name.trim(),
          projectType: data.projectType.trim(),
          description: data.description?.trim() || null,
          clientId: data.clientId,
          contractId: data.contractId,
          projectManagerId: data.projectManagerId,
          startDate: data.startDate,
          targetEndDate: data.targetEndDate,
          status: data.status ?? "PLANNING",
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
              title: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Project",
          entityId: project.id,
          details: {
            after: project,
          },
        },
      });

      return project;
    });
  }

  async updateProject(id: string, data: UpdateProjectDTO, actorId: string) {
    const existing = await this.getAccessibleProject(
      id,
      actorId,
      "project.update",
    );

    const targetClientId = data.clientId ?? existing.clientId;
    const targetContractId =
      data.contractId === undefined ? existing.contractId : data.contractId;
    const targetProjectManagerId =
      data.projectManagerId ?? existing.projectManagerId;
    const targetStartDate = data.startDate ?? existing.startDate;
    const targetEndDate = data.targetEndDate ?? existing.targetEndDate;
    const targetActualEndDate =
      data.actualEndDate === undefined
        ? existing.actualEndDate
        : data.actualEndDate;

    if (data.clientId !== undefined) {
      await this.validateClient(data.clientId);
    }

    await this.validateContract(targetContractId, targetClientId);

    if (
      data.projectManagerId !== undefined &&
      data.projectManagerId !== existing.projectManagerId
    ) {
      await this.validateAssignPermission(actorId, data.projectManagerId);
      await this.validateProjectManager(data.projectManagerId);
    }

    this.validateDates(targetStartDate, targetEndDate, targetActualEndDate);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id },
        data: {
          ...(data.name !== undefined && {
            name: data.name.trim(),
          }),
          ...(data.projectType !== undefined && {
            projectType: data.projectType.trim(),
          }),
          ...(data.description !== undefined && {
            description: data.description.trim() || null,
          }),
          ...(data.clientId !== undefined && {
            clientId: data.clientId,
          }),
          ...(data.contractId !== undefined && {
            contractId: data.contractId,
          }),
          ...(data.projectManagerId !== undefined && {
            projectManagerId: data.projectManagerId,
          }),
          ...(data.startDate !== undefined && {
            startDate: data.startDate,
          }),
          ...(data.targetEndDate !== undefined && {
            targetEndDate: data.targetEndDate,
          }),
          ...(data.actualEndDate !== undefined && {
            actualEndDate: data.actualEndDate,
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
        },
        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
              title: true,
            },
          },
          projectManager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Project",
          entityId: id,
          details: {
            before: existing,
            after: project,
          },
        },
      });

      return project;
    });
  }

  async deleteProject(id: string, actorId: string) {
    const existing = await this.getAccessibleProject(
      id,
      actorId,
      "project.delete",
    );

    const relations = await this.prisma.project.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            services: true,
            tasks: true,
            deliverables: true,
            performanceMetrics: true,
          },
        },
      },
    });

    if (!relations) {
      throw new ApiError("Project tidak ditemukan.", 404);
    }

    const hasRelations =
      relations._count.services > 0 ||
      relations._count.tasks > 0 ||
      relations._count.deliverables > 0 ||
      relations._count.performanceMetrics > 0;

    if (hasRelations) {
      throw new ApiError(
        "Project tidak dapat dihapus karena sudah memiliki service, task, deliverable, atau performance metric.",
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.project.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Project",
          entityId: id,
          details: {
            before: existing,
          },
        },
      });
    });

    return {
      message: "Project berhasil dihapus.",
    };
  }
}
