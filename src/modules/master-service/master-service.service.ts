import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMasterServiceDTO } from "./dto/create-master-service.dto";
import { QueryMasterServiceDTO } from "./dto/query-master-service.dto";
import { UpdateMasterServiceDTO } from "./dto/update-master-service.dto";

@injectable()
export class MasterServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async validateCategory(categoryId?: string | null): Promise<void> {
    if (!categoryId) return;

    const category = await this.prisma.serviceCategory.findUnique({
      where: {
        id: categoryId,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!category) {
      throw new ApiError("Service category tidak ditemukan.", 404);
    }

    if (!category.isActive) {
      throw new ApiError("Service category sedang tidak aktif.", 400);
    }
  }

  private async ensureGlobalPermission(
    actorId: string,
    permission: string,
  ): Promise<void> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope !== "ALL") {
      throw new ApiError(
        "Anda tidak memiliki akses untuk data master ini.",
        403,
      );
    }
  }

  private async validateWorkflowTemplate(
    workflowTemplateId?: string | null,
  ): Promise<void> {
    if (!workflowTemplateId) return;

    const template = await this.prisma.workflowTemplate.findUnique({
      where: { id: workflowTemplateId },
      select: { id: true },
    });

    if (!template) {
      throw new ApiError("Workflow template tidak ditemukan.", 404);
    }
  }

  private async validateUniqueCode(
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.prisma.masterService.findFirst({
      where: {
        code,
        ...(excludeId && {
          id: { not: excludeId },
        }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ApiError(
        `Master service dengan code "${code}" sudah tersedia.`,
        409,
      );
    }
  }

  async getMasterServices(query: QueryMasterServiceDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.MasterServiceWhereInput = {};

    if (query.search) {
      where.OR = [
        {
          code: {
            contains: query.search,
          },
        },
        {
          name: {
            contains: query.search,
          },
        },
        {
          description: {
            contains: query.search,
          },
        },
      ];
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.masterService.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
            },
          },
          defaultTemplate: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
          _count: {
            select: {
              projectServices: true,
            },
          },
        },
      }),
      this.prisma.masterService.count({
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

  async getMasterServiceById(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.read");

    const masterService = await this.prisma.masterService.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
        defaultTemplate: true,
        _count: {
          select: {
            projectServices: true,
          },
        },
      },
    });

    if (!masterService) {
      throw new ApiError("Master service tidak ditemukan.", 404);
    }

    return masterService;
  }

  async createMasterService(data: CreateMasterServiceDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.create");

    const code = data.code.trim().toUpperCase();

    await this.validateUniqueCode(code);
    await this.validateWorkflowTemplate(data.workflowTemplateId);
    await this.validateCategory(data.categoryId);

    return this.prisma.$transaction(async (tx) => {
      const masterService = await tx.masterService.create({
        data: {
          code,
          name: data.name.trim(),
          description: data.description?.trim() || null,
          isActive: data.isActive ?? true,
          workflowTemplateId: data.workflowTemplateId,
          categoryId: data.categoryId ?? null,
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
            },
          },
          defaultTemplate: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "MasterService",
          entityId: masterService.id,
          details: {
            after: masterService,
          },
        },
      });

      return masterService;
    });
  }

  async updateMasterService(
    id: string,
    data: UpdateMasterServiceDTO,
    actorId: string,
  ) {
    await this.ensureGlobalPermission(actorId, "master.service.update");

    const existing = await this.prisma.masterService.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError("Master service tidak ditemukan.", 404);
    }

    const code =
      data.code !== undefined ? data.code.trim().toUpperCase() : undefined;

    if (code !== undefined) {
      await this.validateUniqueCode(code, id);
    }

    if (data.workflowTemplateId !== undefined) {
      await this.validateWorkflowTemplate(data.workflowTemplateId);
    }

    if (
      data.categoryId !== undefined &&
      data.categoryId !== existing.categoryId
    ) {
      await this.validateCategory(data.categoryId);
    }

    return this.prisma.$transaction(async (tx) => {
      const masterService = await tx.masterService.update({
        where: { id },
        data: {
          ...(code !== undefined && { code }),
          ...(data.name !== undefined && {
            name: data.name.trim(),
          }),
          ...(data.categoryId !== undefined && {
            categoryId: data.categoryId,
          }),
          ...(data.description !== undefined && {
            description: data.description.trim() || null,
          }),
          ...(data.isActive !== undefined && {
            isActive: data.isActive,
          }),
          ...(data.workflowTemplateId !== undefined && {
            workflowTemplateId: data.workflowTemplateId,
          }),
        },
        include: {
          category: {
            select: {
              id: true,
              code: true,
              name: true,
              isActive: true,
            },
          },
          defaultTemplate: true,
        },
      });

      // audit...

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "MasterService",
          entityId: id,
          details: {
            before: existing,
            after: masterService,
          },
        },
      });

      return masterService;
    });
  }

  async deleteMasterService(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.delete");

    const existing = await this.prisma.masterService.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            projectServices: true,
            quotationItems: true,
            contractItems: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Master service tidak ditemukan.", 404);
    }

    if (existing._count.projectServices > 0) {
      throw new ApiError(
        "Master service tidak dapat dihapus karena sudah digunakan oleh project.",
        409,
      );
    }

    if (existing._count.quotationItems > 0) {
      throw new ApiError(
        "Master service tidak dapat dihapus karena sudah digunakan pada quotation. Silakan nonaktifkan service.",
        409,
      );
    }

    if (existing._count.contractItems > 0) {
      throw new ApiError(
        "Master service tidak dapat dihapus karena sudah digunakan pada contract. Silakan nonaktifkan service.",
        409,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.masterService.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "MasterService",
          entityId: id,
          details: {
            before: existing,
          },
        },
      });
    });

    return {
      message: "Master service berhasil dihapus.",
    };
  }
}
