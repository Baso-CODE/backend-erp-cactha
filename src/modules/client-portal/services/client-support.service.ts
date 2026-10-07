import {
  Prisma,
  SupportTicketPriority,
  SupportTicketStatus,
} from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateClientSupportMessageDTO } from "../dto/create-client-support-message.dto";
import { CreateClientSupportDTO } from "../dto/create-client-support.dto";
import { QueryClientSupportDTO } from "../dto/query-client-support.dto";
import { ClientPortalAccessService } from "./client-portal-access.service";

@injectable()
export class ClientSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clientPortalAccessService: ClientPortalAccessService,
  ) {}

  async getTickets(query: QueryClientSupportDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.SupportTicketWhereInput = {
      clientId: context.clientId,
      ...(query.status && {
        status: query.status,
      }),
      ...(query.search && {
        OR: [
          {
            ticketNo: {
              contains: query.search,
            },
          },
          {
            subject: {
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

    const [tickets, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          ticketNo: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          requester: {
            select: {
              id: true,
              fullName: true,
            },
          },
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
      }),

      this.prisma.supportTicket.count({
        where,
      }),
    ]);

    return {
      data: tickets,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTicketById(ticketId: string, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        clientId: context.clientId,
      },
      select: {
        id: true,
        ticketNo: true,
        subject: true,
        description: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        requester: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        messages: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            message: true,
            createdAt: true,
            author: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!ticket) {
      throw new ApiError(
        "Support ticket tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    return ticket;
  }

  async createTicket(data: CreateClientSupportDTO, actorId: string) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    if (data.projectId) {
      await this.clientPortalAccessService.ensureProjectAccess(
        data.projectId,
        actorId,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "SUPPORT_TICKET",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "SUPPORT_TICKET",
          value: 1,
        },
      });

      const ticketNo = `TICKET-${String(counter.value).padStart(6, "0")}`;

      const ticket = await tx.supportTicket.create({
        data: {
          ticketNo,
          clientId: context.clientId,
          requesterId: context.contactId,
          projectId: data.projectId ?? null,
          subject: data.subject.trim(),
          description: data.description.trim(),
          priority: data.priority ?? SupportTicketPriority.MEDIUM,
          status: SupportTicketStatus.OPEN,
        },
        select: {
          id: true,
          ticketNo: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          projectId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CLIENT_CREATE_SUPPORT_TICKET",
          entity: "SupportTicket",
          entityId: ticket.id,
          details: {
            ticketNo: ticket.ticketNo,
            clientId: context.clientId,
            projectId: ticket.projectId,
            priority: ticket.priority,
          },
        },
      });

      return ticket;
    });
  }

  async createMessage(
    ticketId: string,
    data: CreateClientSupportMessageDTO,
    actorId: string,
  ) {
    const context =
      await this.clientPortalAccessService.getClientContext(actorId);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        clientId: context.clientId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!ticket) {
      throw new ApiError(
        "Support ticket tidak ditemukan atau tidak dapat diakses.",
        404,
      );
    }

    if (ticket.status === SupportTicketStatus.CLOSED) {
      throw new ApiError(
        "Support ticket yang sudah ditutup tidak dapat menerima pesan baru.",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorId: actorId,
          message: data.message.trim(),
        },
        select: {
          id: true,
          message: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (ticket.status === SupportTicketStatus.WAITING_CLIENT) {
        await tx.supportTicket.update({
          where: {
            id: ticketId,
          },
          data: {
            status: SupportTicketStatus.IN_PROGRESS,
          },
        });
      } else {
        await tx.supportTicket.update({
          where: {
            id: ticketId,
          },
          data: {
            updatedAt: new Date(),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CLIENT_CREATE_SUPPORT_MESSAGE",
          entity: "SupportTicketMessage",
          entityId: message.id,
          details: {
            ticketId,
            clientId: context.clientId,
          },
        },
      });

      return message;
    });
  }
}
