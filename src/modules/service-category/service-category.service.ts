import { AccessScope } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";

import { CreateServiceCategoryDTO } from "./dto/create-service-category.dto";
import { UpdateServiceCategoryDTO } from "./dto/update-service-category.dto";

@injectable()
export class ServiceCategoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async ensureGlobalPermission(
    actorId: string,
    permission: string,
  ): Promise<void> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope !== AccessScope.ALL) {
      throw new ApiError(
        "Anda tidak memiliki akses untuk data master ini.",
        403,
      );
    }
  }

  async getAll(actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.read");

    return this.prisma.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      include: {
        _count: {
          select: {
            masterServices: true,
          },
        },
      },
    });
  }

  async getById(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.read");

    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            masterServices: true,
          },
        },
      },
    });

    if (!category) {
      throw new ApiError("Service category tidak ditemukan.", 404);
    }

    return category;
  }

  async create(input: CreateServiceCategoryDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.create");

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.serviceCategory.create({
        data: {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          description: input.description?.trim() || null,
          isActive: input.isActive ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
        include: {
          _count: {
            select: {
              masterServices: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "ServiceCategory",
          entityId: category.id,
          details: {
            code: category.code,
            name: category.name,
          },
        },
      });

      return category;
    });
  }

  async update(id: string, input: UpdateServiceCategoryDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "master.service.update");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceCategory.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new ApiError("Service category tidak ditemukan.", 404);
      }

      const category = await tx.serviceCategory.update({
        where: { id },
        data: {
          ...(input.code !== undefined && {
            code: input.code.trim().toUpperCase(),
          }),
          ...(input.name !== undefined && {
            name: input.name.trim(),
          }),
          ...(input.description !== undefined && {
            description: input.description?.trim() || null,
          }),
          ...(input.isActive !== undefined && {
            isActive: input.isActive,
          }),
          ...(input.sortOrder !== undefined && {
            sortOrder: input.sortOrder,
          }),
        },
        include: {
          _count: {
            select: {
              masterServices: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "ServiceCategory",
          entityId: id,
          details: {
            before: {
              code: existing.code,
              name: existing.name,
              description: existing.description,
              isActive: existing.isActive,
              sortOrder: existing.sortOrder,
            },
            after: {
              code: category.code,
              name: category.name,
              description: category.description,
              isActive: category.isActive,
              sortOrder: category.sortOrder,
            },
          },
        },
      });

      return category;
    });
  }
}
