import { AccessScope, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreatePerformanceMappingDTO,
  UpdatePerformanceMappingDTO,
} from "../dto/performance-mapping.dto";

type MappingPermission =
  | "performance.mapping.read"
  | "performance.mapping.create"
  | "performance.mapping.update";

@injectable()
export class PerformanceMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
  ) {}

  private async assertManage(
    actorId: string,
    permission: MappingPermission,
  ): Promise<void> {
    const scope = await this.scopes.getPermissionScope(actorId, permission);
    if (scope !== AccessScope.ALL) {
      throw new ApiError(
        "Scope ALL diperlukan untuk mengelola Performance Mapping.",
        403,
      );
    }
  }

  private async getReadWhere(
    actorId: string,
  ): Promise<Prisma.PerformanceMappingWhereInput> {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "performance.mapping.read",
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};
      case AccessScope.OWN:
        return {
          OR: [
            { project: { projectManagerId: actorId } },
            { client: { accountManagerId: actorId } },
          ],
        };
      case AccessScope.TEAM: {
        const members = [
          ...new Set([
            actorId,
            ...(await this.scopes.getTeamMemberIds(actorId)),
          ]),
        ];
        return {
          OR: [
            { project: { projectManagerId: { in: members } } },
            { client: { accountManagerId: { in: members } } },
          ],
        };
      }
      case AccessScope.PROJECT:
        return { project: { projectManagerId: actorId } };
      default:
        throw new ApiError("Scope Performance Mapping tidak didukung.", 403);
    }
  }

  private async validateRelations(
    tx: Prisma.TransactionClient,
    accountId: string,
    clientId: string,
    projectId: string,
    projectServiceId?: string,
  ): Promise<void> {
    const [account, client, project] = await Promise.all([
      tx.performanceAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
          status: true,
          connection: { select: { status: true } },
        },
      }),
      tx.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      }),
      tx.project.findUnique({
        where: { id: projectId },
        select: { id: true, clientId: true },
      }),
    ]);

    if (!account) {
      throw new ApiError("Performance Account tidak ditemukan.", 404);
    }
    if (!client) {
      throw new ApiError("Client tidak ditemukan.", 404);
    }
    if (!project) {
      throw new ApiError("Project tidak ditemukan.", 404);
    }
    if (project.clientId !== clientId) {
      throw new ApiError("Project harus berasal dari Client yang sama.", 400);
    }
    if (account.status !== "ACTIVE") {
      throw new ApiError("Performance Account tidak aktif.", 400);
    }

    if (projectServiceId) {
      const service = await tx.projectService.findUnique({
        where: { id: projectServiceId },
        select: { id: true, projectId: true },
      });

      if (!service) {
        throw new ApiError("Project Service tidak ditemukan.", 404);
      }
      if (service.projectId !== projectId) {
        throw new ApiError(
          "Project Service harus berasal dari Project yang dipilih.",
          400,
        );
      }
    }
  }

  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    accountId: string,
    clientId: string,
    projectId: string,
    projectServiceId: string | undefined,
    excludeId?: string,
  ): Promise<void> {
    const foreignClientMapping = await tx.performanceMapping.findFirst({
      where: {
        accountId,
        isActive: true,
        clientId: { not: clientId },
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });

    if (foreignClientMapping) {
      throw new ApiError(
        "Performance Account sudah digunakan Client lain. Satu account hanya boleh dimapping ke satu Client aktif.",
        409,
      );
    }

    const duplicate = await tx.performanceMapping.findFirst({
      where: {
        accountId,
        projectId,
        projectServiceId: projectServiceId ?? null,
        isActive: true,
        ...(excludeId && { id: { not: excludeId } }),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ApiError(
        "Mapping aktif untuk Account, Project, dan Service ini sudah ada.",
        409,
      );
    }
  }

  async getAll(accountId?: string, actorId?: string) {
    if (!actorId) {
      throw new ApiError("Identitas pengguna diperlukan.", 401);
    }

    const ownership = await this.getReadWhere(actorId);

    return this.prisma.performanceMapping.findMany({
      where: {
        AND: [ownership, ...(accountId ? [{ accountId }] : [])],
      },
      include: {
        account: {
          select: {
            id: true,
            externalId: true,
            name: true,
            connection: {
              select: {
                id: true,
                platform: true,
                name: true,
              },
            },
          },
        },
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
          },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        projectService: {
          select: {
            id: true,
            masterService: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async create(dto: CreatePerformanceMappingDTO, actorId: string) {
    await this.assertManage(actorId, "performance.mapping.create");

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.validateRelations(
            tx,
            dto.accountId,
            dto.clientId,
            dto.projectId,
            dto.projectServiceId,
          );

          await this.assertNoConflict(
            tx,
            dto.accountId,
            dto.clientId,
            dto.projectId,
            dto.projectServiceId,
          );

          const mapping = await tx.performanceMapping.create({
            data: {
              accountId: dto.accountId,
              clientId: dto.clientId,
              projectId: dto.projectId,
              projectServiceId: dto.projectServiceId ?? null,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: "PERFORMANCE_MAPPING_CREATED",
              entity: "PerformanceMapping",
              entityId: mapping.id,
              details: {
                accountId: mapping.accountId,
                clientId: mapping.clientId,
                projectId: mapping.projectId,
                projectServiceId: mapping.projectServiceId,
              },
            },
          });

          return mapping;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      ) {
        throw new ApiError(
          "Mapping mengalami konflik dengan transaksi lain. Silakan coba kembali.",
          409,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePerformanceMappingDTO, actorId: string) {
    await this.assertManage(actorId, "performance.mapping.update");

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.performanceMapping.findUnique({
            where: { id },
          });

          if (!existing) {
            throw new ApiError("Performance Mapping tidak ditemukan.", 404);
          }

          await this.validateRelations(
            tx,
            existing.accountId,
            dto.clientId,
            dto.projectId,
            dto.projectServiceId,
          );

          const isActive = dto.isActive ?? existing.isActive;

          if (isActive) {
            await this.assertNoConflict(
              tx,
              existing.accountId,
              dto.clientId,
              dto.projectId,
              dto.projectServiceId,
              id,
            );
          }

          const mapping = await tx.performanceMapping.update({
            where: { id },
            data: {
              clientId: dto.clientId,
              projectId: dto.projectId,
              projectServiceId: dto.projectServiceId ?? null,
              isActive,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: "PERFORMANCE_MAPPING_UPDATED",
              entity: "PerformanceMapping",
              entityId: id,
              details: {
                previous: {
                  clientId: existing.clientId,
                  projectId: existing.projectId,
                  projectServiceId: existing.projectServiceId,
                  isActive: existing.isActive,
                },
                current: {
                  clientId: mapping.clientId,
                  projectId: mapping.projectId,
                  projectServiceId: mapping.projectServiceId,
                  isActive: mapping.isActive,
                },
              },
            },
          });

          return mapping;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      ) {
        throw new ApiError(
          "Mapping mengalami konflik dengan transaksi lain. Silakan coba kembali.",
          409,
        );
      }
      throw error;
    }
  }
}
