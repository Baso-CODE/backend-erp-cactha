import {
  ApprovalStatus,
  ClientStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

@injectable()
export class ClientNotificationEventService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Mengirim notifikasi ketika approval deliverable
   * diminta kepada client.
   *
   * Bisa dipanggil di dalam transaksi approval existing,
   * atau tanpa transaksi ketika diperlukan.
   */
  async notifyApprovalRequested(
    approvalId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ created: number; skipped: number }> {
    if (tx) {
      return this.createApprovalNotifications(approvalId, tx);
    }

    return this.prisma.$transaction(async (transaction) =>
      this.createApprovalNotifications(approvalId, transaction),
    );
  }

  private async createApprovalNotifications(
    approvalId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ created: number; skipped: number }> {
    // PostgreSQL advisory lock:
    // mencegah dua request memproses event yang sama
    // secara bersamaan.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('client-approval-notification'),
        hashtext(${approvalId})
      )
    `;

    const approval = await tx.approvalRequest.findUnique({
      where: { id: approvalId },
      select: {
        id: true,
        clientId: true,
        status: true,
        deliverable: {
          select: {
            id: true,
            name: true,
            version: true,
            project: {
              select: {
                id: true,
                clientId: true,
              },
            },
          },
        },
      },
    });

    if (!approval) {
      throw new ApiError("Approval request tidak ditemukan.", 404);
    }

    if (approval.status !== ApprovalStatus.PENDING_CLIENT_APPROVAL) {
      throw new ApiError(
        "Approval request belum berada pada status yang tepat.",
        409,
      );
    }

    // Pastikan approval dan project berasal
    // dari client yang sama.
    if (approval.clientId !== approval.deliverable.project.clientId) {
      throw new ApiError("Client approval dan project tidak sesuai.", 409);
    }

    const contacts = await tx.contactPerson.findMany({
      where: {
        clientId: approval.clientId,
        status: ClientStatus.ACTIVE,
        client: {
          status: ClientStatus.ACTIVE,
        },
        userId: { not: null },
        user: {
          isActive: true,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    let created = 0;
    let skipped = 0;

    for (const contact of contacts) {
      if (!contact.userId) {
        skipped++;
        continue;
      }

      const existing = await tx.notification.findFirst({
        where: {
          recipientId: contact.userId,
          type: NotificationType.APPROVAL_REQUESTED,
          entity: "ApprovalRequest",
          entityId: approval.id,
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await tx.notification.create({
        data: {
          recipientId: contact.userId,
          type: NotificationType.APPROVAL_REQUESTED,
          title: "Persetujuan Deliverable Diperlukan",
          message:
            `Deliverable "${approval.deliverable.name}" ` +
            `versi ${approval.deliverable.version} ` +
            "menunggu persetujuan Anda.",

          entity: "ApprovalRequest",
          entityId: approval.id,

          actionUrl: "/portal/approvals",

          metadata: {
            clientId: approval.clientId,
            projectId: approval.deliverable.project.id,
            deliverableId: approval.deliverable.id,
            approvalId: approval.id,
          },
        },
      });

      created++;
    }

    return { created, skipped };
  }
}
