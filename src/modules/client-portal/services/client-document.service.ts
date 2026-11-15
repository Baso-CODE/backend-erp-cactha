import { ApprovalStatus, AttachmentVisibility, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { CloudinaryService } from "../../../common/cloudinary.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientDocumentDTO } from "../dto/query-client-document.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

const VISIBLE_STATUSES: ApprovalStatus[] = [
  ApprovalStatus.PENDING_CLIENT_APPROVAL,
  ApprovalStatus.REVISION_REQUIRED,
  ApprovalStatus.APPROVED,
];

@injectable()
export class ClientDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  private buildAccessWhere(
    clientId: string,
    projectId?: string,
    search?: string,
  ): Prisma.AttachmentWhereInput {
    const keyword = search?.trim();

    return {
      AND: [
        // Hanya aset Cloudinary authenticated.
        {
          publicId: { not: null },
          resourceType: "raw",
          fileUrl: {
            contains: "/raw/authenticated/",
          },
        },

        // Aturan akses untuk setiap sumber dokumen.
        {
          OR: [
            // Deliverable yang telah diserahkan kepada client.
            {
              deliverableId: { not: null },
              deliverable: {
                is: {
                  status: {
                    in: VISIBLE_STATUSES,
                  },
                  project: {
                    clientId,
                  },
                },
              },
            },

            // Attachment project yang eksplisit dibagikan.
            {
              deliverableId: null,
              projectId: { not: null },
              visibility: AttachmentVisibility.CLIENT_PORTAL,
              project: {
                is: { clientId },
              },
            },

            // Attachment contract yang eksplisit dibagikan.
            {
              deliverableId: null,
              projectId: null,
              contractId: { not: null },
              visibility: AttachmentVisibility.CLIENT_PORTAL,
              contract: {
                is: { clientId },
              },
            },
          ],
        },

        // Filter project tetap digabung dengan ownership.
        ...(projectId
          ? [
              {
                OR: [
                  { projectId },
                  {
                    deliverable: {
                      is: { projectId },
                    },
                  },
                ],
              } satisfies Prisma.AttachmentWhereInput,
            ]
          : []),

        ...(keyword
          ? [
              {
                fileName: {
                  contains: keyword,
                  mode: "insensitive" as const,
                },
              } satisfies Prisma.AttachmentWhereInput,
            ]
          : []),
      ],
    };
  }

  async getDocuments(query: QueryClientDocumentDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    if (query.projectId) {
      await this.clientPortalAccessService.ensureProjectAccess(
        query.projectId,
        actorId,
      );
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where = this.buildAccessWhere(
      context.clientId,
      query.projectId,
      query.search,
    );

    const [documents, total] = await this.prisma.$transaction([
      this.prisma.attachment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          fileName: true,
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
              status: true,
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

      this.prisma.attachment.count({ where }),
    ]);

    return {
      data: documents.map((document) => ({
        ...document,

        // Prioritaskan relasi Deliverable karena upload
        // Deliverable juga menyimpan projectId.
        source: document.deliverable
          ? ("DELIVERABLE" as const)
          : document.contract
            ? ("CONTRACT" as const)
            : document.project
              ? ("PROJECT" as const)
              : ("OTHER" as const),
      })),

      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getDownloadUrl(documentId: string, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const where = this.buildAccessWhere(context.clientId);

    const document = await this.prisma.attachment.findFirst({
      where: {
        AND: [where, { id: documentId }],
      },
      select: {
        id: true,
        fileName: true,
        publicId: true,
      },
    });

    if (!document?.publicId) {
      throw new ApiError(
        "Dokumen tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    return {
      id: document.id,
      fileName: document.fileName,
      url: this.cloudinaryService.getAuthenticatedDownloadUrl(
        document.publicId,
      ),
      expiresInSeconds: 60,
    };
  }
}
