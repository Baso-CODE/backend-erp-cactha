import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientProjectDTO } from "../dto/query-client-project.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getProjects(query: QueryClientProjectDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.ProjectWhereInput = {
      clientId: context.clientId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.search && {
        OR: [
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
            description: {
              contains: query.search,
            },
          },
        ],
      }),
    };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          projectCode: true,
          name: true,
          projectType: true,
          description: true,
          status: true,
          startDate: true,
          targetEndDate: true,
          actualEndDate: true,
          projectManager: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              services: true,
              deliverables: true,
              tasks: true,
            },
          },
        },
      }),

      this.prisma.project.count({
        where,
      }),
    ]);

    return {
      data: projects,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProjectById(projectId: string, actorId: string) {
    const { context } =
      await this.clientPortalAccessService.ensureProjectAccess(
        projectId,
        actorId,
      );

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        clientId: context.clientId,
      },
      select: {
        id: true,
        projectCode: true,
        name: true,
        projectType: true,
        description: true,
        status: true,
        startDate: true,
        targetEndDate: true,
        actualEndDate: true,

        projectManager: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },

        services: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            masterService: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
              },
            },
          },
        },

        deliverables: {
          select: {
            id: true,
            name: true,
            version: true,
            description: true,
            fileUrl: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },

        _count: {
          select: {
            services: true,
            tasks: true,
            deliverables: true,
          },
        },
      },
    });

    if (!project) {
      throw new ApiError("Project tidak ditemukan.", 404);
    }

    return project;
  }
}
