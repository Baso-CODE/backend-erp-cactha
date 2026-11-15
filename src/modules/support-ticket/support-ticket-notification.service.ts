import { ClientStatus, NotificationType, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../utils/api-error";
import { NotificationService } from "../notification/notification.service";

type InternalEvent = "CREATED" | "CLIENT_REPLIED";

type ClientEvent = "ADMIN_REPLIED" | "RESOLVED" | "CLOSED";

@injectable()
export class SupportTicketNotificationService {
  constructor(private readonly notifications: NotificationService) {}

  private async getTicket(tx: Prisma.TransactionClient, ticketId: string) {
    const ticket = await tx.supportTicket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        ticketNo: true,
        subject: true,
        clientId: true,

        client: {
          select: {
            status: true,
            accountManagerId: true,
          },
        },

        project: {
          select: {
            projectManagerId: true,
          },
        },

        requester: {
          select: {
            userId: true,
            status: true,
            user: {
              select: {
                isActive: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new ApiError("Support ticket tidak ditemukan.", 404);
    }

    return ticket;
  }

  /**
   * Client membuat tiket atau mengirim balasan.
   * Notifikasi ditujukan ke tim internal.
   */
  async notifyInternal(
    tx: Prisma.TransactionClient,
    ticketId: string,
    actorId: string,
    event: InternalEvent,
  ) {
    const ticket = await this.getTicket(tx, ticketId);

    const recipientIds = [
      ...new Set(
        [
          ticket.client.accountManagerId,
          ticket.project?.projectManagerId,
        ].filter((id): id is string => Boolean(id)),
      ),
    ].filter((id) => id !== actorId);

    if (recipientIds.length === 0) {
      return { created: 0 };
    }

    const recipients = await tx.user.findMany({
      where: {
        id: { in: recipientIds },
        isActive: true,
      },
      select: { id: true },
    });

    const title =
      event === "CREATED"
        ? "Support Ticket Baru"
        : "Client Membalas Support Ticket";

    const message =
      event === "CREATED"
        ? `${ticket.ticketNo} telah dibuat oleh client.`
        : `Client mengirim balasan pada tiket ${ticket.ticketNo}.`;

    for (const recipient of recipients) {
      await this.notifications.create(
        {
          recipientId: recipient.id,
          type: NotificationType.SYSTEM,
          title,
          message,
          entity: "SupportTicket",
          entityId: ticket.id,
          actionUrl: "/internal/support",
          metadata: {
            audience: "INTERNAL",
            event,
            clientId: ticket.clientId,
            ticketId: ticket.id,
          },
        },
        tx,
      );
    }

    return { created: recipients.length };
  }

  /**
   * Tim internal membalas atau menyelesaikan tiket.
   * Hanya contact person pembuat tiket yang menerima.
   */
  async notifyClient(
    tx: Prisma.TransactionClient,
    ticketId: string,
    actorId: string,
    event: ClientEvent,
  ) {
    const ticket = await this.getTicket(tx, ticketId);

    const recipientId = ticket.requester.userId;

    if (
      ticket.client.status !== ClientStatus.ACTIVE ||
      ticket.requester.status !== ClientStatus.ACTIVE ||
      !recipientId ||
      !ticket.requester.user?.isActive ||
      recipientId === actorId
    ) {
      return { created: 0 };
    }

    const titles: Record<ClientEvent, string> = {
      ADMIN_REPLIED: "Tim Catha Membalas Tiket Anda",
      RESOLVED: "Support Ticket Telah Diselesaikan",
      CLOSED: "Support Ticket Telah Ditutup",
    };

    const messages: Record<ClientEvent, string> = {
      ADMIN_REPLIED: `Ada balasan baru dari tim Catha pada tiket ${ticket.ticketNo}.`,
      RESOLVED: `Tiket ${ticket.ticketNo} telah ditandai selesai.`,
      CLOSED: `Tiket ${ticket.ticketNo} telah ditutup.`,
    };

    await this.notifications.create(
      {
        recipientId,
        type: NotificationType.SYSTEM,
        title: titles[event],
        message: messages[event],
        entity: "SupportTicket",
        entityId: ticket.id,
        actionUrl: "/portal/support",
        metadata: {
          audience: "CLIENT",
          event,
          clientId: ticket.clientId,
          ticketId: ticket.id,
        },
      },
      tx,
    );

    return { created: 1 };
  }
}
