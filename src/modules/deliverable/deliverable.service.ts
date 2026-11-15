import { ApprovalStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";

import { ClientNotificationEventService } from "../client-portal/services/client-notification-event.service";

export interface CreateDeliverableInput {
  projectId: string;
  name: string;
  description?: string;
  version?: string;
  fileUrl?: string;
}

export interface UpdateDeliverableInput {
  name?: string;
  description?: string | null;
  version?: string;
  fileUrl?: string | null;
}

@injectable()
export class DeliverableService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
    private readonly notifications: ClientNotificationEventService,
  ) {}
  private async getAccessibleProject(
    projectId: string,
    actorId: string,
    permission = "project.update",
  ) {
    const scope = await this.scopes.getPermissionScope(actorId, permission);

    if (scope !== "ALL" && scope !== "OWN") {
      throw new ApiError(
        "Scope akses project belum didukung untuk operasi ini.",
        403,
      );
    }

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...(scope === "OWN" && {
          projectManagerId: actorId,
        }),
      },
      select: {
        id: true,
        clientId: true,
        projectCode: true,
        name: true,
      },
    });

    if (!project) {
      throw new ApiError("Project tidak ditemukan atau akses ditolak.", 404);
    }

    return project;
  }

  async createDraft(input: CreateDeliverableInput, actorId: string) {
    const project = await this.getAccessibleProject(input.projectId, actorId);

    const name = input.name?.trim();
    const version = input.version?.trim() || "1.0";

    if (!name || name.length > 200) {
      throw new ApiError(
        "Nama deliverable wajib diisi dan maksimal 200 karakter.",
        400,
      );
    }

    if (version.length > 50) {
      throw new ApiError("Versi deliverable maksimal 50 karakter.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const deliverable = await tx.deliverable.create({
        data: {
          projectId: project.id,
          name,
          version,
          description: input.description?.trim() || null,
          fileUrl: input.fileUrl?.trim() || null,
          status: ApprovalStatus.DRAFT,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE_DELIVERABLE",
          entity: "Deliverable",
          entityId: deliverable.id,
          details: {
            projectId: project.id,
            name: deliverable.name,
            version: deliverable.version,
            status: deliverable.status,
          },
        },
      });

      return deliverable;
    });
  }

  async getAll(projectId: string, actorId: string) {
    await this.getAccessibleProject(projectId, actorId, "project.read");
    return this.prisma.deliverable.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        approvalRequests: {
          orderBy: { requestedAt: "desc" },
          select: {
            id: true,
            status: true,
            requestedAt: true,
            respondedAt: true,
            feedback: true,
          },
        },
      },
    });
  }

  async submitForApproval(deliverableId: string, actorId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    const project = await this.getAccessibleProject(
      deliverable.projectId,
      actorId,
    );

    return this.prisma.$transaction(async (tx) => {
      // Serialisasi pengiriman approval untuk deliverable yang sama.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('deliverable-submit'),
          hashtext(${deliverableId})
        )
      `;

      const current = await tx.deliverable.findUnique({
        where: { id: deliverableId },
      });

      if (!current?.fileUrl?.trim()) {
        throw new ApiError(
          "File deliverable wajib tersedia sebelum dikirim ke client.",
          400,
        );
      }
      if (!current || current.projectId !== project.id) {
        throw new ApiError("Deliverable tidak ditemukan.", 404);
      }

      if (current.status !== ApprovalStatus.READY_FOR_CLIENT) {
        throw new ApiError(
          "Deliverable harus berstatus READY_FOR_CLIENT sebelum dikirim.",
          409,
        );
      }

      const existingPending = await tx.approvalRequest.findFirst({
        where: {
          deliverableId,
          status: ApprovalStatus.PENDING_CLIENT_APPROVAL,
        },
        select: { id: true },
      });

      if (existingPending) {
        throw new ApiError(
          "Deliverable sudah memiliki approval yang menunggu client.",
          409,
        );
      }

      const update = await tx.deliverable.updateMany({
        where: {
          id: deliverableId,
          projectId: project.id,
          status: ApprovalStatus.READY_FOR_CLIENT,
        },
        data: {
          status: ApprovalStatus.PENDING_CLIENT_APPROVAL,
          submittedAt: new Date(),
        },
      });

      if (update.count !== 1) {
        throw new ApiError("Status deliverable berubah. Muat ulang data.", 409);
      }

      const approval = await tx.approvalRequest.create({
        data: {
          deliverableId,
          clientId: project.clientId,
          status: ApprovalStatus.PENDING_CLIENT_APPROVAL,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "SUBMIT_DELIVERABLE_FOR_APPROVAL",
          entity: "Deliverable",
          entityId: deliverableId,
          details: {
            projectId: project.id,
            clientId: project.clientId,
            approvalId: approval.id,
          },
        },
      });

      const notificationResult =
        await this.notifications.notifyApprovalRequested(approval.id, tx);

      return {
        approval,
        notifications: notificationResult,
      };
    });
  }
  async startReview(deliverableId: string, actorId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.getAccessibleProject(deliverable.projectId, actorId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliverable.updateMany({
        where: {
          id: deliverableId,
          status: ApprovalStatus.DRAFT,
        },
        data: {
          status: ApprovalStatus.INTERNAL_REVIEW,
        },
      });

      if (updated.count !== 1) {
        throw new ApiError(
          "Deliverable harus berstatus DRAFT untuk memulai review.",
          409,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "START_DELIVERABLE_INTERNAL_REVIEW",
          entity: "Deliverable",
          entityId: deliverableId,
          details: {
            from: "DRAFT",
            to: "INTERNAL_REVIEW",
          },
        },
      });

      return tx.deliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
    });
  }

  async markReady(deliverableId: string, actorId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
        name: true,
        fileUrl: true,
      },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.getAccessibleProject(deliverable.projectId, actorId);

    if (!deliverable.fileUrl?.trim()) {
      throw new ApiError(
        "File deliverable wajib tersedia sebelum dinyatakan siap.",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliverable.updateMany({
        where: {
          id: deliverableId,
          status: ApprovalStatus.INTERNAL_REVIEW,
        },
        data: {
          status: ApprovalStatus.READY_FOR_CLIENT,
        },
      });

      if (updated.count !== 1) {
        throw new ApiError("Deliverable harus berstatus INTERNAL_REVIEW.", 409);
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "MARK_DELIVERABLE_READY_FOR_CLIENT",
          entity: "Deliverable",
          entityId: deliverableId,
          details: {
            from: "INTERNAL_REVIEW",
            to: "READY_FOR_CLIENT",
          },
        },
      });

      return tx.deliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
    });
  }

  async reopenDraft(deliverableId: string, actorId: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
        status: true,
      },
    });

    if (!deliverable) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.getAccessibleProject(deliverable.projectId, actorId);

    const allowedStatuses: ApprovalStatus[] = [
      ApprovalStatus.INTERNAL_REVIEW,
      ApprovalStatus.READY_FOR_CLIENT,
      ApprovalStatus.REVISION_REQUIRED,
    ];

    if (!allowedStatuses.includes(deliverable.status)) {
      throw new ApiError(
        "Deliverable tidak dapat dikembalikan ke draft pada status ini.",
        409,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliverable.updateMany({
        where: {
          id: deliverableId,
          status: {
            in: allowedStatuses,
          },
        },
        data: {
          status: ApprovalStatus.DRAFT,
          submittedAt: null,
          approvedAt: null,
        },
      });

      if (updated.count !== 1) {
        throw new ApiError("Status deliverable berubah. Muat ulang data.", 409);
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "REOPEN_DELIVERABLE_DRAFT",
          entity: "Deliverable",
          entityId: deliverableId,
          details: {
            from: deliverable.status,
            to: "DRAFT",
          },
        },
      });

      return tx.deliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
    });
  }

  async updateDraft(
    deliverableId: string,
    input: UpdateDeliverableInput,
    actorId: string,
  ) {
    const existing = await this.prisma.deliverable.findUnique({
      where: { id: deliverableId },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!existing) {
      throw new ApiError("Deliverable tidak ditemukan.", 404);
    }

    await this.getAccessibleProject(existing.projectId, actorId);

    const data: Prisma.DeliverableUpdateManyMutationInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();

      if (!name || name.length > 200) {
        throw new ApiError(
          "Nama deliverable wajib diisi, maksimal 200 karakter.",
          400,
        );
      }

      data.name = name;
    }

    if (input.version !== undefined) {
      const version = input.version.trim();

      if (!version || version.length > 50) {
        throw new ApiError(
          "Versi deliverable wajib diisi, maksimal 50 karakter.",
          400,
        );
      }

      data.version = version;
    }

    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }

    if (input.fileUrl !== undefined) {
      const fileUrl = input.fileUrl?.trim() || null;

      if (
        fileUrl &&
        (!fileUrl.startsWith("https://") || fileUrl.length > 2048)
      ) {
        throw new ApiError(
          "URL file harus HTTPS dan maksimal 2048 karakter.",
          400,
        );
      }

      data.fileUrl = fileUrl;
    }

    if (Object.keys(data).length === 0) {
      throw new ApiError("Tidak ada perubahan deliverable.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliverable.updateMany({
        where: {
          id: deliverableId,
          projectId: existing.projectId,
          status: ApprovalStatus.DRAFT,
        },
        data,
      });

      if (updated.count !== 1) {
        throw new ApiError("Hanya deliverable DRAFT yang dapat diubah.", 409);
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE_DELIVERABLE_DRAFT",
          entity: "Deliverable",
          entityId: deliverableId,
          details: {
            updatedFields: Object.keys(data),
            projectId: existing.projectId,
          },
        },
      });

      return tx.deliverable.findUniqueOrThrow({
        where: { id: deliverableId },
      });
    });
  }
}
