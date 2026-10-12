import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreatePerformanceMappingDTO,
  UpdatePerformanceMappingDTO,
} from "../dto/performance-mapping.dto";

@injectable()
export class PerformanceMappingService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateRelations(
    tx: Prisma.TransactionClient,
    accountId: string,
    clientId: string,
    projectId: string,
    projectServiceId?: string,
  ) {
    const [account, client, project] = await Promise.all([
      tx.performanceAccount.findUnique({
        where: { id: accountId },
        select: {
          id: true,
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

    if (!account)
      throw new ApiError("Performance Account tidak ditemukan.", 404);
    if (!client) throw new ApiError("Client tidak ditemukan.", 404);
    if (!project) throw new ApiError("Project tidak ditemukan.", 404);

    if (project.clientId !== clientId) {
      throw new ApiError("Project harus berasal dari Client yang sama.", 400);
    }

    if (projectServiceId) {
      const service = await tx.projectService.findUnique({
        where: { id: projectServiceId },
        select: { id: true, projectId: true },
      });

      if (!service) throw new ApiError("Project Service tidak ditemukan.", 404);

      if (service.projectId !== projectId) {
        throw new ApiError(
          "Project Service harus berasal dari Project yang dipilih.",
          400,
        );
      }
    }
  }

  private async assertNoDuplicate(
    tx: Prisma.TransactionClient,
    accountId: string,
    projectId: string,
    projectServiceId?: string,
    excludeId?: string,
  ) {
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
        "Mapping aktif untuk kombinasi Account, Project, dan Service ini sudah ada.",
        409,
      );
    }
  }

  async getAll(accountId?: string) {
    return this.prisma.performanceMapping.findMany({
      where: {
        ...(accountId && { accountId }),
      },
      include: {
        account: {
          select: {
            id: true,
            externalId: true,
            name: true,
            connection: { select: { id: true, platform: true, name: true } },
          },
        },
        client: { select: { id: true, clientCode: true, companyName: true } },
        project: { select: { id: true, projectCode: true, name: true } },
        projectService: {
          select: { id: true, masterService: { select: { name: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  async create(dto: CreatePerformanceMappingDTO) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.validateRelations(
          tx,
          dto.accountId,
          dto.clientId,
          dto.projectId,
          dto.projectServiceId,
        );

        await this.assertNoDuplicate(
          tx,
          dto.accountId,
          dto.projectId,
          dto.projectServiceId,
        );

        return tx.performanceMapping.create({
          data: {
            accountId: dto.accountId,
            clientId: dto.clientId,
            projectId: dto.projectId,
            projectServiceId: dto.projectServiceId ?? null,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async update(id: string, dto: UpdatePerformanceMappingDTO) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.performanceMapping.findUnique({
          where: { id },
        });

        if (!existing)
          throw new ApiError("Performance Mapping tidak ditemukan.", 404);

        await this.validateRelations(
          tx,
          existing.accountId,
          dto.clientId,
          dto.projectId,
          dto.projectServiceId,
        );

        if (dto.isActive !== false) {
          await this.assertNoDuplicate(
            tx,
            existing.accountId,
            dto.projectId,
            dto.projectServiceId,
            id,
          );
        }

        return tx.performanceMapping.update({
          where: { id },
          data: {
            clientId: dto.clientId,
            projectId: dto.projectId,
            projectServiceId: dto.projectServiceId ?? null,
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
