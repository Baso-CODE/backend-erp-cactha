import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateWorkflowTemplateDTO } from "./dto/create-workflow-template.dto";
import { QueryWorkflowTemplateDTO } from "./dto/query-workflow-template.dto";
import { UpdateWorkflowTemplateDTO } from "./dto/update-workflow-template.dto";

@injectable()
export class WorkflowTemplateService {
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

    if (scope !== "ALL") {
      throw new ApiError(
        "Anda tidak memiliki akses untuk workflow template ini.",
        403,
      );
    }
  }

  private normalizeSteps(steps: CreateWorkflowTemplateDTO["steps"]) {
    const keys = new Set<string>();
    const orders = new Set<number>();

    const normalized = steps
      .map((step) => ({
        key: step.key.trim().toLowerCase(),
        name: step.name.trim(),
        order: step.order,
      }))
      .sort((a, b) => a.order - b.order);

    for (const step of normalized) {
      if (keys.has(step.key)) {
        throw new ApiError(
          `Workflow step key "${step.key}" tidak boleh duplikat.`,
          400,
        );
      }

      if (orders.has(step.order)) {
        throw new ApiError(
          `Workflow step order "${step.order}" tidak boleh duplikat.`,
          400,
        );
      }

      keys.add(step.key);
      orders.add(step.order);
    }

    return normalized;
  }

  async getWorkflowTemplates(query: QueryWorkflowTemplateDTO, actorId: string) {
    await this.ensureGlobalPermission(actorId, "workflow.template.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.WorkflowTemplateWhereInput = {};

    if (query.search) {
      where.OR = [
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

    const [data, total] = await this.prisma.$transaction([
      this.prisma.workflowTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          _count: {
            select: {
              masterServices: true,
              instances: true,
            },
          },
        },
      }),
      this.prisma.workflowTemplate.count({
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

  async getWorkflowTemplateById(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "workflow.template.read");

    const workflowTemplate = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        masterServices: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            masterServices: true,
            instances: true,
          },
        },
      },
    });

    if (!workflowTemplate) {
      throw new ApiError("Workflow template tidak ditemukan.", 404);
    }

    return workflowTemplate;
  }

  async createWorkflowTemplate(
    data: CreateWorkflowTemplateDTO,
    actorId: string,
  ) {
    await this.ensureGlobalPermission(actorId, "workflow.template.create");

    const steps = this.normalizeSteps(data.steps);

    return this.prisma.$transaction(async (tx) => {
      const workflowTemplate = await tx.workflowTemplate.create({
        data: {
          name: data.name.trim(),
          description: data.description?.trim() || null,
          steps,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "WorkflowTemplate",
          entityId: workflowTemplate.id,
          details: {
            after: workflowTemplate,
          },
        },
      });

      return workflowTemplate;
    });
  }

  async updateWorkflowTemplate(
    id: string,
    data: UpdateWorkflowTemplateDTO,
    actorId: string,
  ) {
    await this.ensureGlobalPermission(actorId, "workflow.template.update");

    const existing = await this.prisma.workflowTemplate.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new ApiError("Workflow template tidak ditemukan.", 404);
    }

    const steps =
      data.steps !== undefined ? this.normalizeSteps(data.steps) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const workflowTemplate = await tx.workflowTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined && {
            name: data.name.trim(),
          }),
          ...(data.description !== undefined && {
            description: data.description.trim() || null,
          }),
          ...(steps !== undefined && {
            steps,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "WorkflowTemplate",
          entityId: id,
          details: {
            before: existing,
            after: workflowTemplate,
          },
        },
      });

      return workflowTemplate;
    });
  }

  async deleteWorkflowTemplate(id: string, actorId: string) {
    await this.ensureGlobalPermission(actorId, "workflow.template.delete");

    const existing = await this.prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            masterServices: true,
            instances: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Workflow template tidak ditemukan.", 404);
    }

    if (existing._count.masterServices > 0) {
      throw new ApiError(
        "Workflow template tidak dapat dihapus karena masih digunakan oleh master service.",
        409,
      );
    }

    if (existing._count.instances > 0) {
      throw new ApiError(
        "Workflow template tidak dapat dihapus karena sudah memiliki workflow instance.",
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workflowTemplate.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "WorkflowTemplate",
          entityId: id,
          details: {
            before: existing,
          },
        },
      });
    });

    return {
      message: "Workflow template berhasil dihapus.",
    };
  }
}
