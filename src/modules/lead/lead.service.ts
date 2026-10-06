import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { UserEligibilityService } from "../rbac/user-eligibility.service";
import { CreateLeadDTO } from "./dto/create-lead.dto";
import { QueryLeadDTO } from "./dto/query-lead.dto";
import { UpdateLeadDTO } from "./dto/update-lead.dto";

@injectable()
export class LeadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userEligibilityService: UserEligibilityService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async getAccessWhere(
    actorId: string,
    permission: string,
  ): Promise<Prisma.LeadWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    switch (scope) {
      case "ALL":
        return {};

      case "TEAM": {
        const teamMemberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return {
          assigneeId: {
            in: teamMemberIds,
          },
        };
      }

      case "OWN":
        return {
          assigneeId: actorId,
        };

      case "PROJECT":
      case "CLIENT":
      default:
        throw new ApiError(
          `Scope ${scope} belum didukung untuk resource Lead`,
          403,
        );
    }
  }

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

    const accessWhere = await this.getAccessWhere(actorId, "crm.lead.read");

    const where: Prisma.LeadWhereInput = {
      AND: [
        accessWhere,
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
        orderBy: {
          createdAt: "desc",
        },
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

  async getLeadById(id: string, actorId: string) {
    const accessWhere = await this.getAccessWhere(actorId, "crm.lead.read");

    const lead = await this.prisma.lead.findFirst({
      where: {
        id,
        ...accessWhere,
      },
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
      throw new ApiError(
        "Lead tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    return lead;
  }

  async createLead(data: CreateLeadDTO, actorId: string) {
    await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.lead.create",
    );

    if (data.assigneeId !== actorId) {
      await this.accessScopeService.getPermissionScope(
        actorId,
        "crm.lead.assign",
      );
    }

    await this.userEligibilityService.validateUserEligibility(data.assigneeId, {
      permissions: ["crm.lead.read", "crm.lead.update"],
    });

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
    const accessWhere = await this.getAccessWhere(actorId, "crm.lead.update");

    const existing = await this.prisma.lead.findFirst({
      where: {
        id,
        ...accessWhere,
      },
    });

    if (!existing) {
      throw new ApiError(
        "Lead tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (
      data.assigneeId !== undefined &&
      data.assigneeId !== existing.assigneeId
    ) {
      await this.accessScopeService.getPermissionScope(
        actorId,
        "crm.lead.assign",
      );

      await this.userEligibilityService.validateUserEligibility(
        data.assigneeId,
        {
          permissions: ["crm.lead.read", "crm.lead.update"],
        },
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.lead.update({
        where: {
          id,
        },
        data: {
          ...(data.company !== undefined && {
            company: data.company,
          }),
          ...(data.pic !== undefined && {
            pic: data.pic,
          }),
          ...(data.phone !== undefined && {
            phone: data.phone,
          }),
          ...(data.email !== undefined && {
            email: data.email,
          }),
          ...(data.industry !== undefined && {
            industry: data.industry,
          }),
          ...(data.address !== undefined && {
            address: data.address,
          }),
          ...(data.estimatedValue !== undefined && {
            estimatedValue: data.estimatedValue,
          }),
          ...(data.source !== undefined && {
            source: data.source,
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
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
    const accessWhere = await this.getAccessWhere(actorId, "crm.lead.delete");

    const existing = await this.prisma.lead.findFirst({
      where: {
        id,
        ...accessWhere,
      },
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
      throw new ApiError(
        "Lead tidak ditemukan atau Anda tidak memiliki akses.",
        404,
      );
    }

    if (existing._count.proposals > 0 || existing._count.quotations > 0) {
      throw new ApiError(
        "Lead tidak dapat dihapus karena sudah memiliki proposal atau quotation.",
        409,
      );
    }

    await this.prisma.$transaction(async (tx) => {
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
            assigneeId: existing.assigneeId,
          },
        },
      });

      await tx.lead.delete({
        where: {
          id,
        },
      });
    });

    return {
      message: `Lead "${existing.company}" berhasil dihapus.`,
    };
  }

  async getLeadMetrics(actorId: string) {
    const accessWhere = await this.getAccessWhere(actorId, "crm.lead.read");

    const [total, newLeads, qualified, proposal, negotiation, won, lost] =
      await this.prisma.$transaction([
        this.prisma.lead.count({
          where: accessWhere,
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
            status: "NEW",
          },
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
            status: "QUALIFIED",
          },
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
            status: "PROPOSAL",
          },
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
            status: "NEGOTIATION",
          },
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
            status: "WON",
          },
        }),
        this.prisma.lead.count({
          where: {
            ...accessWhere,
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
