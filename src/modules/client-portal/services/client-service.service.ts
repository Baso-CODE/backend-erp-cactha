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
      ...(query.search && {
        OR: [
          {
            masterService: {
              name: {
                contains: query.search,
              },
            },
          },
          {
            masterService: {
              code: {
                contains: query.search,
              },
            },
          },
          {
            project: {
              name: {
                contains: query.search,
              },
            },
          },
          {
            project: {
              projectCode: {
                contains: query.search,
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
        orderBy: {
          updatedAt: "desc",
        },
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
