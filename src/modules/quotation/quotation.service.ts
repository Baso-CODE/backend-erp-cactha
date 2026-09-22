// quotation.service.ts

import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateQuotationDTO } from "./dto/create-quotation.dto";
import { QueryQuotationDTO } from "./dto/query-quotation.dto";
import { UpdateQuotationDTO } from "./dto/update-quotation.dto";

@injectable()
export class QuotationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  async getAllQuotations(query: QueryQuotationDTO, actorId: string) {
    const { leadId, status, search, page = 1, limit = 10 } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.quotation.read",
    );

    const accessFilter: Prisma.QuotationWhereInput =
      scope === "ALL"
        ? {}
        : {
            lead: {
              assigneeId: actorId,
            },
          };

    const where: Prisma.QuotationWhereInput = {
      AND: [
        accessFilter,
        {
          ...(leadId && { leadId }),
          ...(status && { status }),
          ...(search && {
            OR: [
              { quotationNo: { contains: search } },
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

    const [quotations, total] = await this.prisma.$transaction([
      this.prisma.quotation.findMany({
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
          _count: {
            select: {
              contracts: true,
            },
          },
        },
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      data: quotations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getQuotationById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "crm.quotation.read",
    );

    const quotation = await this.prisma.quotation.findFirst({
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
        contracts: {
          select: {
            id: true,
            contractNo: true,
            title: true,
            status: true,
            startDate: true,
            endDate: true,
            value: true,
          },
        },
      },
    });

    if (!quotation) {
      throw new Error("Quotation tidak ditemukan atau tidak dapat diakses.");
    }

    return quotation;
  }

  async createQuotation(data: CreateQuotationDTO, actorId: string) {
    await this.validateLeadAccess(data.leadId, actorId, "crm.quotation.create");

    return this.prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: {
          key: "QUOTATION",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "QUOTATION",
          value: 1,
        },
      });

      const quotationNo = `QUO-${String(counter.value).padStart(6, "0")}`;

      const quotation = await tx.quotation.create({
        data: {
          quotationNo,
          version: "1.0",
          leadId: data.leadId,
          amount: data.amount,
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
          entity: "Quotation",
          entityId: quotation.id,
          details: {
            quotationNo: quotation.quotationNo,
            leadId: quotation.leadId,
            amount: quotation.amount,
            version: quotation.version,
            status: quotation.status,
          },
        },
      });

      return quotation;
    });
  }

  async updateQuotation(id: string, data: UpdateQuotationDTO, actorId: string) {
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error("Quotation tidak ditemukan.");
    }

    await this.validateLeadAccess(
      existing.leadId,
      actorId,
      "crm.quotation.update",
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          ...(data.amount !== undefined && {
            amount: data.amount,
          }),
          ...(data.status !== undefined && {
            status: data.status,
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
          entity: "Quotation",
          entityId: id,
          details: {
            before: {
              amount: existing.amount,
              status: existing.status,
            },
            after: {
              amount: updated.amount,
              status: updated.status,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteQuotation(id: string, actorId: string) {
    const existing = await this.prisma.quotation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            contracts: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error("Quotation tidak ditemukan.");
    }

    await this.validateLeadAccess(
      existing.leadId,
      actorId,
      "crm.quotation.delete",
    );

    if (existing._count.contracts > 0) {
      throw new Error(
        "Quotation tidak dapat dihapus karena sudah memiliki contract.",
      );
    }

    if (existing.status !== "DRAFT") {
      throw new Error(
        "Hanya quotation dengan status DRAFT yang dapat dihapus.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quotation.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Quotation",
          entityId: id,
          details: {
            quotationNo: existing.quotationNo,
            leadId: existing.leadId,
            amount: existing.amount,
            version: existing.version,
            status: existing.status,
          },
        },
      });
    });

    return {
      message: `Quotation "${existing.quotationNo}" berhasil dihapus.`,
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
}
