import { ApprovalStatus, NotificationType } from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getApprovals(actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    return this.prisma.approvalRequest.findMany({
      where: {
        clientId: context.clientId,
      },
      orderBy: {
        requestedAt: "desc",
      },
      select: {
        id: true,
        status: true,
        feedback: true,
        requestedAt: true,
        respondedAt: true,
        approver: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        deliverable: {
          select: {
            id: true,
            name: true,
            version: true,
            description: true,
            fileUrl: true,
            status: true,
            dueDate: true,
            submittedAt: true,
            approvedAt: true,
            project: {
              select: {
                id: true,
                projectCode: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async approve(approvalId: string, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const approval = await this.getAccessibleApproval(
      approvalId,
      context.clientId,
    );

    if (approval.status !== ApprovalStatus.PENDING_CLIENT_APPROVAL) {
      throw new ApiError(
        "Approval request ini sudah tidak dapat di-approve.",
        400,
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approvalRequest.update({
        where: {
          id: approval.id,
        },
        data: {
          status: ApprovalStatus.APPROVED,
          approverId: context.contactId,
          feedback: null,
          respondedAt: now,
        },
      });

      await tx.deliverable.update({
        where: {
          id: approval.deliverableId,
        },
        data: {
          status: ApprovalStatus.APPROVED,
          approvedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CLIENT_APPROVE_DELIVERABLE",
          entity: "ApprovalRequest",
          entityId: approval.id,
          details: {
            deliverableId: approval.deliverableId,
            clientId: context.clientId,
          },
        },
      });

      await tx.notification.create({
        data: {
          recipientId: approval.deliverable.project.projectManagerId,
          type: NotificationType.APPROVAL_RESPONDED,
          title: "Deliverable Disetujui",
          message: `${approval.deliverable.name} telah disetujui oleh client.`,
          entity: "Deliverable",
          entityId: approval.deliverableId,
          actionUrl: `/internal/projects/${approval.deliverable.projectId}`,
          metadata: {
            approvalId: approval.id,
            clientId: context.clientId,
          },
        },
      });

      return updatedApproval;
    });

    return result;
  }

  async requestRevision(approvalId: string, feedback: string, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const approval = await this.getAccessibleApproval(
      approvalId,
      context.clientId,
    );

    if (approval.status !== ApprovalStatus.PENDING_CLIENT_APPROVAL) {
      throw new ApiError(
        "Approval request ini sudah tidak dapat direvisi.",
        400,
      );
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approvalRequest.update({
        where: {
          id: approval.id,
        },
        data: {
          status: ApprovalStatus.REVISION_REQUIRED,
          approverId: context.contactId,
          feedback: feedback.trim(),
          respondedAt: now,
        },
      });

      await tx.deliverable.update({
        where: {
          id: approval.deliverableId,
        },
        data: {
          status: ApprovalStatus.REVISION_REQUIRED,
          approvedAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CLIENT_REQUEST_REVISION",
          entity: "ApprovalRequest",
          entityId: approval.id,
          details: {
            deliverableId: approval.deliverableId,
            clientId: context.clientId,
            feedback: feedback.trim(),
          },
        },
      });

      await tx.notification.create({
        data: {
          recipientId: approval.deliverable.project.projectManagerId,
          type: NotificationType.APPROVAL_RESPONDED,
          title: "Revisi Deliverable Diminta",
          message: `${approval.deliverable.name} membutuhkan revisi dari client.`,
          entity: "Deliverable",
          entityId: approval.deliverableId,
          actionUrl: `/internal/projects/${approval.deliverable.projectId}`,
          metadata: {
            approvalId: approval.id,
            clientId: context.clientId,
          },
        },
      });

      return updatedApproval;
    });

    return result;
  }

  private async getAccessibleApproval(approvalId: string, clientId: string) {
    const approval = await this.prisma.approvalRequest.findFirst({
      where: {
        id: approvalId,
        clientId,
      },
      select: {
        id: true,
        status: true,
        deliverableId: true,
        deliverable: {
          select: {
            id: true,
            name: true,
            projectId: true,
            project: {
              select: {
                projectManagerId: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      throw new ApiError(
        "Approval request tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    return approval;
  }
}
