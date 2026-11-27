import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientServiceDTO } from "../dto/query-client-service.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getServiceCategories(actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const projectServiceWhere: Prisma.ProjectServiceWhereInput = {
      project: {
        clientId: context.clientId,
      },
    };

    const [categories, uncategorizedCount] = await this.prisma.$transaction([
      this.prisma.serviceCategory.findMany({
        where: {
          masterServices: {
            some: {
              projectServices: {
                some: projectServiceWhere,
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          sortOrder: true,
        },
      }),

      this.prisma.projectService.count({
        where: {
          ...projectServiceWhere,
          masterService: {
            categoryId: null,
          },
        },
      }),
    ]);

    return {
      categories,
      hasUncategorized: uncategorizedCount > 0,
    };
  }

  async getServices(query: QueryClientServiceDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    if (query.projectId) {
      await this.clientPortalAccessService.ensureProjectAccess(
        query.projectId,
        actorId,
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const keyword = query.search?.trim();

    const where: Prisma.ProjectServiceWhereInput = {
      project: {
        clientId: context.clientId,
      },

      ...(query.projectId && {
        projectId: query.projectId,
      }),

      ...(query.status && {
        status: query.status,
      }),

      ...(query.categoryId && {
        masterService: {
          categoryId:
            query.categoryId === "uncategorized" ? null : query.categoryId,
        },
      }),

      ...(keyword && {
        OR: [
          {
            masterService: {
              name: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
          {
            masterService: {
              code: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
          {
            masterService: {
              category: {
                is: {
                  name: {
                    contains: keyword,
                    mode: "insensitive",
                  },
                },
              },
            },
          },
          {
            project: {
              name: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
          {
            project: {
              projectCode: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        ],
      }),
    };

    const [services, total] = await this.prisma.$transaction([
      this.prisma.projectService.findMany({
        where,
        skip,
        take: limit,

        orderBy: [
          {
            masterService: {
              category: {
                sortOrder: "asc",
              },
            },
          },
          {
            masterService: {
              category: {
                name: "asc",
              },
            },
          },
          {
            masterService: {
              category: {
                id: "asc",
              },
            },
          },
          { updatedAt: "desc" },
          { id: "desc" },
        ],

        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,

          masterService: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,

              categoryId: true,

              category: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  sortOrder: true,
                },
              },
            },
          },

          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
              status: true,
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
      data: services,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
