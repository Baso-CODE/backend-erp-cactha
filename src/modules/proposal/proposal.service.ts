// proposal.service.ts

import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateProposalDTO } from "./dto/create-proposal.dto";
import { QueryProposalDTO } from "./dto/query-proposal.dto";
import { UpdateProposalDTO } from "./dto/update-proposal.dto";

@injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async getAllProposals(query: QueryProposalDTO, actorId: string) {
    const { leadId, status, search, page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.proposal.read",
    );

    const accessFilter: Prisma.ProposalWhereInput =
      scope === "ALL"
        ? {}
        : {
            lead: {
              assigneeId: actorId,
            },
          };

    const where: Prisma.ProposalWhereInput = {
      AND: [
        accessFilter,
        {
          ...(leadId && { leadId }),
          ...(status && { status }),
          ...(search && {
            OR: [
              { proposalNo: { contains: search } },
              { subject: { contains: search } },
              {
                lead: {
                  company: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [proposals, total] = await this.prisma.$transaction([
      this.prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
              pic: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return {
      data: proposals,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getProposalById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.proposal.read",
    );

    const proposal = await this.prisma.proposal.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          lead: {
            assigneeId: actorId,
          },
        }),
      },
      include: {
        lead: {
          select: {
            id: true,
            leadCode: true,
            company: true,
            pic: true,
            phone: true,
            email: true,
            status: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new Error("Proposal tidak ditemukan atau tidak dapat diakses.");
    }

    return proposal;
  }

  async createProposal(data: CreateProposalDTO, actorId: string) {
    await this.validateLeadAccess(data.leadId, actorId, "crm.proposal.create");

    this.validateProposalDates(data.proposalDate, data.validUntil);

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "PROPOSAL",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "PROPOSAL",
          value: 1,
        },
      });

      const proposalNo = `PROP-${String(counter.value).padStart(6, "0")}`;

      const proposal = await tx.proposal.create({
        data: {
          proposalNo,
          version: "1.0",
          leadId: data.leadId,
          subject: data.subject,
          amount: data.amount,
          proposalDate: new Date(data.proposalDate),
          validUntil: new Date(data.validUntil),
          fileUrl: data.fileUrl,
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
              pic: true,
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Proposal",
          entityId: proposal.id,
          details: {
            proposalNo: proposal.proposalNo,
            leadId: proposal.leadId,
            subject: proposal.subject,
            amount: proposal.amount,
            version: proposal.version,
            status: proposal.status,
            proposalDate: proposal.proposalDate,
            validUntil: proposal.validUntil,
          },
        },
      });

      return proposal;
    });
  }

  async updateProposal(id: string, data: UpdateProposalDTO, actorId: string) {
    const existing = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Proposal tidak ditemukan.");
    }

    await this.validateLeadAccess(
      existing.leadId,
      actorId,
      "crm.proposal.update",
    );

    const proposalDate = data.proposalDate
      ? new Date(data.proposalDate)
      : existing.proposalDate;

    const validUntil = data.validUntil
      ? new Date(data.validUntil)
      : existing.validUntil;

    this.validateProposalDates(
      proposalDate.toISOString(),
      validUntil.toISOString(),
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.proposal.update({
        where: { id },
        data: {
          ...(data.subject !== undefined && {
            subject: data.subject,
          }),
          ...(data.amount !== undefined && {
            amount: data.amount,
          }),
          ...(data.proposalDate !== undefined && {
            proposalDate: new Date(data.proposalDate),
          }),
          ...(data.validUntil !== undefined && {
            validUntil: new Date(data.validUntil),
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
          ...(data.fileUrl !== undefined && {
            fileUrl: data.fileUrl,
          }),
        },
        include: {
          lead: {
            select: {
              id: true,
              leadCode: true,
              company: true,
              pic: true,
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Proposal",
          entityId: id,
          details: {
            before: {
              subject: existing.subject,
              amount: existing.amount,
              proposalDate: existing.proposalDate,
              validUntil: existing.validUntil,
              status: existing.status,
              fileUrl: existing.fileUrl,
            },
            after: {
              subject: updated.subject,
              amount: updated.amount,
              proposalDate: updated.proposalDate,
              validUntil: updated.validUntil,
              status: updated.status,
              fileUrl: updated.fileUrl,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteProposal(id: string, actorId: string) {
    const existing = await this.prisma.proposal.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Proposal tidak ditemukan.");
    }

    await this.validateLeadAccess(
      existing.leadId,
      actorId,
      "crm.proposal.delete",
    );

    if (existing.status !== "DRAFT") {
      throw new Error("Hanya proposal dengan status DRAFT yang dapat dihapus.");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.proposal.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Proposal",
          entityId: id,
          details: {
            proposalNo: existing.proposalNo,
            leadId: existing.leadId,
            subject: existing.subject,
            amount: existing.amount,
            version: existing.version,
            status: existing.status,
          },
        },
      });
    });

    return {
      message: `Proposal "${existing.proposalNo}" berhasil dihapus.`,
    };
  }

  private async validateLeadAccess(
    leadId: string,
    actorId: string,
    permissionCode: string,
  ): Promise<void> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permissionCode,
    );

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        ...(scope !== "ALL" && {
          assigneeId: actorId,
        }),
      },
      select: {
        id: true,
      },
    });

    if (!lead) {
      throw new Error(
        "Lead tidak ditemukan atau Anda tidak memiliki akses ke lead ini.",
      );
    }
  }

  private validateProposalDates(
    proposalDate: string,
    validUntil: string,
  ): void {
    const start = new Date(proposalDate);
    const end = new Date(validUntil);

    if (end < start) {
      throw new Error(
        "Tanggal berlaku proposal tidak boleh lebih awal dari tanggal proposal.",
      );
    }
  }
}
