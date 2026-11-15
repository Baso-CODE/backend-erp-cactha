import { AccessScope, Prisma, SupportTicketStatus } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";

import { QuerySupportTicketDTO } from "./dto/query-support-ticket.dto";
import { UpdateSupportTicketDTO } from "./dto/update-support-ticket.dto";
import { SupportTicketNotificationService } from "./support-ticket-notification.service";

const ALLOWED_TRANSITIONS: Record<SupportTicketStatus, SupportTicketStatus[]> =
  {
    OPEN: ["IN_PROGRESS", "CLOSED"],
    IN_PROGRESS: ["WAITING_CLIENT", "RESOLVED", "CLOSED"],
    WAITING_CLIENT: ["IN_PROGRESS", "RESOLVED", "CLOSED"],
    RESOLVED: ["IN_PROGRESS", "CLOSED"],
    CLOSED: [],
  };

@injectable()
export class SupportTicketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
    private readonly ticketNotifications: SupportTicketNotificationService,
  ) {}

  private async accessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.SupportTicketWhereInput> {
    const scope = await this.scopes.getPermissionScope(actorId, permission);

    if (scope === AccessScope.ALL) {
      return {};
    }

    if (scope === AccessScope.OWN || scope === AccessScope.CLIENT) {
      return {
        OR: [
          { client: { accountManagerId: actorId } },
          { project: { projectManagerId: actorId } },
        ],
      };
    }

    if (scope === AccessScope.TEAM || scope === AccessScope.PROJECT) {
      const members =
        scope === AccessScope.TEAM
          ? [
              ...new Set([
                actorId,
                ...(await this.scopes.getTeamMemberIds(actorId)),
              ]),
            ]
          : [actorId];

      return {
        OR: [
          {
            client: {
              accountManagerId: { in: members },
            },
          },
          {
            project: {
              projectManagerId: { in: members },
            },
          },
        ],
      };
    }

    throw new ApiError("Scope akses support tidak didukung.", 403);
  }

  async getAll(query: QuerySupportTicketDTO, actorId: string) {
    const access = await this.accessWhere(actorId, "client.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.SupportTicketWhereInput = {
      AND: [
        access,
        {
          ...(query.status && { status: query.status }),
          ...(query.priority && { priority: query.priority }),
          ...(query.search?.trim() && {
            OR: [
              {
                ticketNo: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                subject: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                client: {
                  companyName: {
                    contains: query.search.trim(),
                    mode: "insensitive",
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          ticketNo: true,
          subject: true,
          description: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
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
          _count: {
            select: { messages: true },
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(ticketId: string, actorId: string) {
    const access = await this.accessWhere(actorId, "client.read");

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        AND: [{ id: ticketId }, access],
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
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
          },
        },
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
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            authorId: true,
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
        "Support ticket tidak ditemukan atau akses ditolak.",
        404,
      );
    }

    return ticket;
  }

  async update(
    ticketId: string,
    input: UpdateSupportTicketDTO,
    actorId: string,
  ) {
    const access = await this.accessWhere(actorId, "client.update");

    if (input.status === undefined && input.priority === undefined) {
      throw new ApiError("Status atau prioritas harus diisi.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('support-ticket'),
          hashtext(${ticketId})
        )
      `;

      const ticket = await tx.supportTicket.findFirst({
        where: {
          AND: [{ id: ticketId }, access],
        },
        select: {
          id: true,
          status: true,
          priority: true,
        },
      });

      if (!ticket) {
        throw new ApiError(
          "Support ticket tidak ditemukan atau akses ditolak.",
          404,
        );
      }

      if (
        input.status !== undefined &&
        input.status !== ticket.status &&
        !ALLOWED_TRANSITIONS[ticket.status].includes(input.status)
      ) {
        throw new ApiError(
          `Transisi ${ticket.status} ke ${input.status} tidak diizinkan.`,
          409,
        );
      }

      const result = await tx.supportTicket.update({
        where: { id: ticket.id },
        data: {
          ...(input.status !== undefined && {
            status: input.status,
          }),
          ...(input.priority !== undefined && {
            priority: input.priority,
          }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "INTERNAL_UPDATE_SUPPORT_TICKET",
          entity: "SupportTicket",
          entityId: ticketId,
          details: {
            previousStatus: ticket.status,
            newStatus: result.status,
            previousPriority: ticket.priority,
            newPriority: result.priority,
          },
        },
      });

      if (input.status !== undefined && input.status !== ticket.status) {
        if (input.status === SupportTicketStatus.RESOLVED) {
          await this.ticketNotifications.notifyClient(
            tx,
            ticketId,
            actorId,
            "RESOLVED",
          );
        }

        if (input.status === SupportTicketStatus.CLOSED) {
          await this.ticketNotifications.notifyClient(
            tx,
            ticketId,
            actorId,
            "CLOSED",
          );
        }
      }

      return result;
    });
  }

  async reply(ticketId: string, message: string, actorId: string) {
    const access = await this.accessWhere(actorId, "client.update");

    const content = message?.trim();

    if (!content || content.length > 10000) {
      throw new ApiError("Pesan wajib diisi dan maksimal 10000 karakter.", 400);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext('support-ticket'),
          hashtext(${ticketId})
        )
      `;

      const ticket = await tx.supportTicket.findFirst({
        where: {
          AND: [{ id: ticketId }, access],
        },
        select: {
          id: true,
          status: true,
          clientId: true,
        },
      });

      if (!ticket) {
        throw new ApiError(
          "Support ticket tidak ditemukan atau akses ditolak.",
          404,
        );
      }

      if (
        ticket.status === SupportTicketStatus.CLOSED ||
        ticket.status === SupportTicketStatus.RESOLVED
      ) {
        throw new ApiError("Tiket harus aktif sebelum dapat dibalas.", 409);
      }

      const created = await tx.supportTicketMessage.create({
        data: {
          ticketId,
          authorId: actorId,
          message: content,
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

      await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: SupportTicketStatus.WAITING_CLIENT,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "INTERNAL_REPLY_SUPPORT_TICKET",
          entity: "SupportTicketMessage",
          entityId: created.id,
          details: {
            ticketId,
            clientId: ticket.clientId,
          },
        },
      });

      await this.ticketNotifications.notifyClient(
        tx,
        ticketId,
        actorId,
        "ADMIN_REPLIED",
      );

      return created;
    });
  }
}
