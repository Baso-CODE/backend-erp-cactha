import { AttachmentVisibility, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientDocumentDTO } from "../dto/query-client-document.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getDocuments(query: QueryClientDocumentDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    if (query.projectId) {
      await this.clientPortalAccessService.ensureProjectAccess(
        query.projectId,
        actorId,
      );
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const clientOwnership: Prisma.AttachmentWhereInput[] = [
      {
        project: {
          is: {
            clientId: context.clientId,
          },
        },
      },
      {
        deliverable: {
          is: {
            project: {
              clientId: context.clientId,
            },
          },
        },
      },
      {
        contract: {
          is: {
            clientId: context.clientId,
          },
        },
      },
    ];

    const where: Prisma.AttachmentWhereInput = {
      visibility: AttachmentVisibility.CLIENT_PORTAL,

      ...(query.search && {
        fileName: {
          contains: query.search,
        },
      }),

      ...(query.projectId
        ? {
            OR: [
              {
                projectId: query.projectId,
              },
              {
                deliverable: {
                  is: {
                    projectId: query.projectId,
                  },
                },
              },
            ],
          }
        : {
            OR: clientOwnership,
          }),
    };

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          fileType: true,
          fileSize: true,
          createdAt: true,
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          deliverable: {
            select: {
              id: true,
              name: true,
              version: true,
              project: {
                select: {
                  id: true,
                  projectCode: true,
                  name: true,
                },
              },
            },
          },
          contract: {
            select: {
              id: true,
              contractNo: true,
              title: true,
            },
          },
        },
      }),

      this.prisma.attachment.count({
        where,
      }),
    ]);

    return {
      data: documents.map((document) => ({
        ...document,
        source: document.project
          ? "PROJECT"
          : document.deliverable
            ? "DELIVERABLE"
            : document.contract
              ? "CONTRACT"
              : "OTHER",
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
