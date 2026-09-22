// lead.service.ts

import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { UserAccessService } from "../../helpers/user-access.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLeadDTO } from "./dto/create-lead.dto";
import { QueryLeadDTO } from "./dto/query-lead.dto";
import { UpdateLeadDTO } from "./dto/update-lead.dto";

@injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userAccessService: UserAccessService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async getAllLeads(query: QueryLeadDTO, actorId: string) {
    const {
      search,
      status,
      assigneeId,
      source,
      industry,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.lead.read",
    );

    const accessFilter: Prisma.LeadWhereInput =
      scope === "ALL"
        ? {}
        : scope === "TEAM"
          ? {
              assignee: {
                roles: {
                  some: {
                    role: {
                      code: {
                        in: ["SALES_MANAGER", "SALES_EXECUTIVE"],
                      },
                    },
                  },
                },
              },
            }
          : {
              assigneeId: actorId,
            };

    const where: Prisma.LeadWhereInput = {
      AND: [
        accessFilter,
        {
          ...(status && { status }),
          ...(assigneeId && { assigneeId }),
          ...(source && { source }),
          ...(industry && { industry }),
          ...(search && {
            OR: [
              { leadCode: { contains: search } },
              { company: { contains: search } },
              { pic: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
            ],
          }),
        },
      ],
    };

    const [leads, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              activities: true,
              proposals: true,
              quotations: true,
              attachments: true,
            },
          },
        },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return {
      data: leads,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLeadById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        activities: {
          orderBy: {
            activityDate: "desc",
          },
          include: {
            performedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        proposals: {
          orderBy: {
            createdAt: "desc",
          },
        },
        quotations: {
          orderBy: {
            createdAt: "desc",
          },
        },
        attachments: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!lead) {
      throw new Error("Lead tidak ditemukan.");
    }

    return lead;
  }

  async createLead(data: CreateLeadDTO, actorId: string) {
    await this.userAccessService.validateSalesAssignee(data.assigneeId);

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "LEAD",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "LEAD",
          value: 1,
        },
      });

      const leadCode = `LEAD-${String(counter.value).padStart(6, "0")}`;

      const lead = await tx.lead.create({
        data: {
          leadCode,
          company: data.company,
          pic: data.pic,
          phone: data.phone,
          email: data.email,
          industry: data.industry,
          address: data.address,
          estimatedValue: data.estimatedValue,
          source: data.source,
          assigneeId: data.assigneeId,
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Lead",
          entityId: lead.id,
          details: {
            leadCode: lead.leadCode,
            company: lead.company,
            pic: lead.pic,
            status: lead.status,
            assigneeId: lead.assigneeId,
          },
        },
      });

      return lead;
    });
  }

  async updateLead(id: string, data: UpdateLeadDTO, actorId: string) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Lead tidak ditemukan.");
    }

    if (data.assigneeId) {
      await this.userAccessService.validateSalesAssignee(data.assigneeId);
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: { id },
        data: {
          ...(data.company !== undefined && { company: data.company }),
          ...(data.pic !== undefined && { pic: data.pic }),
          ...(data.phone !== undefined && { phone: data.phone }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.industry !== undefined && { industry: data.industry }),
          ...(data.address !== undefined && { address: data.address }),
          ...(data.estimatedValue !== undefined && {
            estimatedValue: data.estimatedValue,
          }),
          ...(data.source !== undefined && { source: data.source }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assigneeId !== undefined && {
            assigneeId: data.assigneeId,
          }),
        },
        include: {
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Lead",
          entityId: id,
          details: {
            before: {
              company: existing.company,
              pic: existing.pic,
              phone: existing.phone,
              email: existing.email,
              industry: existing.industry,
              address: existing.address,
              estimatedValue: existing.estimatedValue,
              source: existing.source,
              status: existing.status,
              assigneeId: existing.assigneeId,
            },
            after: {
              company: updated.company,
              pic: updated.pic,
              phone: updated.phone,
              email: updated.email,
              industry: updated.industry,
              address: updated.address,
              estimatedValue: updated.estimatedValue,
              source: updated.source,
              status: updated.status,
              assigneeId: updated.assigneeId,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteLead(id: string, actorId: string) {
    const existing = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            proposals: true,
            quotations: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Lead tidak ditemukan.");
    }

    if (existing._count.proposals > 0 || existing._count.quotations > 0) {
      throw new Error(
        "Lead tidak dapat dihapus karena sudah memiliki proposal atau quotation.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.lead.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Lead",
          entityId: id,
          details: {
            leadCode: existing.leadCode,
            company: existing.company,
            pic: existing.pic,
            status: existing.status,
          },
        },
      });
    });

    return {
      message: `Lead "${existing.company}" berhasil dihapus.`,
    };
  }

  async getLeadMetrics(actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.lead.read",
    );

    const accessFilter: Prisma.LeadWhereInput =
      scope === "ALL"
        ? {}
        : {
            assigneeId: actorId,
          };

    const [total, newLeads, qualified, proposal, negotiation, won, lost] =
      await this.prisma.$transaction([
        this.prisma.lead.count({
          where: accessFilter,
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "NEW",
          },
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "QUALIFIED",
          },
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "PROPOSAL",
          },
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "NEGOTIATION",
          },
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "WON",
          },
        }),

        this.prisma.lead.count({
          where: {
            ...accessFilter,
            status: "LOST",
          },
        }),
      ]);

    return {
      total,
      new: newLeads,
      qualified,
      proposal,
      negotiation,
      won,
      lost,
    };
  }
}
