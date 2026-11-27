// quotation.service.ts

import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
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
          serviceItems: {
            orderBy: [
              { categorySortOrderSnapshot: "asc" },
              { serviceNameSnapshot: "asc" },
              { id: "asc" },
            ],
          },
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
        serviceItems: {
          orderBy: [
            { categorySortOrderSnapshot: "asc" },
            { serviceNameSnapshot: "asc" },
            { id: "asc" },
          ],
        },
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
        _count: {
          select: {
            contracts: true,
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
          amount: new Prisma.Decimal(data.amount),
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

      const serviceItems = await this.syncServiceItems(
        tx,
        quotation.id,
        data.masterServiceIds ?? [],
      );

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Quotation",
          entityId: quotation.id,

          details: {
            quotationNo: quotation.quotationNo,
            leadId: quotation.leadId,
            amount: quotation.amount.toString(),
            version: quotation.version,
            status: quotation.status,
            masterServiceIds: serviceItems.map((item) => item.masterServiceId),
          },
        },
      });

      return {
        ...quotation,
        serviceItems,
      };
    });
  }

  async updateQuotation(id: string, data: UpdateQuotationDTO, actorId: string) {
    const accessible = await this.prisma.quotation.findUnique({
      where: { id },
      select: { leadId: true },
    });

    if (!accessible) {
      throw new ApiError("Quotation tidak ditemukan.", 404);
    }

    await this.validateLeadAccess(
      accessible.leadId,
      actorId,
      "crm.quotation.update",
    );

    return this.prisma.$transaction(async (tx) => {
      // PostgreSQL row lock untuk perubahan quotation bersamaan.
      await tx.$queryRaw`
      SELECT "id"
      FROM "Quotation"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

      const existing = await tx.quotation.findUnique({
        where: { id },
        include: {
          serviceItems: true,
          _count: {
            select: { contracts: true },
          },
        },
      });

      if (!existing || existing.leadId !== accessible.leadId) {
        throw new ApiError("Quotation tidak ditemukan.", 404);
      }

      const amountChanged =
        data.amount !== undefined &&
        !existing.amount.equals(new Prisma.Decimal(data.amount));

      const existingIds = new Set(
        existing.serviceItems.map((item) => item.masterServiceId),
      );

      const servicesChanged =
        data.masterServiceIds !== undefined &&
        (data.masterServiceIds.length !== existingIds.size ||
          data.masterServiceIds.some(
            (serviceId) => !existingIds.has(serviceId),
          ));

      if (
        (amountChanged || servicesChanged) &&
        (existing.status !== "DRAFT" || existing._count.contracts > 0)
      ) {
        throw new ApiError(
          "Nominal dan layanan hanya dapat diubah pada quotation Draft yang belum memiliki contract.",
          409,
        );
      }

      if (existing.status !== "DRAFT" && data.status === "DRAFT") {
        throw new ApiError(
          "Quotation yang sudah diproses tidak dapat dikembalikan ke Draft.",
          409,
        );
      }

      if (servicesChanged && data.masterServiceIds !== undefined) {
        await this.syncServiceItems(tx, id, data.masterServiceIds);
      }

      const updated = await tx.quotation.update({
        where: { id },

        data: {
          ...(amountChanged && {
            amount: new Prisma.Decimal(data.amount!),
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

          serviceItems: {
            orderBy: [
              { categorySortOrderSnapshot: "asc" },
              { serviceNameSnapshot: "asc" },
              { id: "asc" },
            ],
          },

          _count: {
            select: { contracts: true },
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
              amount: existing.amount.toString(),
              status: existing.status,
              masterServiceIds: [...existingIds],
            },

            after: {
              amount: updated.amount.toString(),
              status: updated.status,
              masterServiceIds: updated.serviceItems.map(
                (item) => item.masterServiceId,
              ),
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
      const deleted = await tx.quotation.deleteMany({
        where: {
          id,
          status: "DRAFT",
          contracts: {
            none: {},
          },
        },
      });

      if (deleted.count !== 1) {
        throw new ApiError(
          "Quotation sudah berubah atau tidak dapat dihapus.",
          409,
        );
      }
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

  private async syncServiceItems(
    tx: Prisma.TransactionClient,
    quotationId: string,
    masterServiceIds: string[],
  ) {
    const existing = await tx.quotationServiceItem.findMany({
      where: { quotationId },
      select: {
        id: true,
        masterServiceId: true,
      },
    });

    const existingIds = new Set(existing.map((item) => item.masterServiceId));

    const requestedIds = new Set(masterServiceIds);

    if (requestedIds.size !== masterServiceIds.length) {
      throw new ApiError("Terdapat master service duplikat.", 400);
    }

    const newIds = masterServiceIds.filter((id) => !existingIds.has(id));

    // Hanya validasi layanan yang baru ditambahkan.
    // Layanan lama tetap mempertahankan snapshot-nya.
    const newServices = await tx.masterService.findMany({
      where: {
        id: { in: newIds },
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        category: {
          select: {
            id: true,
            code: true,
            name: true,
            sortOrder: true,
          },
        },
      },
    });

    if (newServices.length !== newIds.length) {
      throw new ApiError(
        "Salah satu master service tidak ditemukan atau tidak aktif.",
        400,
      );
    }

    const removedIds = existing
      .filter((item) => !requestedIds.has(item.masterServiceId))
      .map((item) => item.id);

    if (removedIds.length > 0) {
      await tx.quotationServiceItem.deleteMany({
        where: {
          quotationId,
          id: { in: removedIds },
        },
      });
    }

    if (newServices.length > 0) {
      await tx.quotationServiceItem.createMany({
        data: newServices.map((service) => ({
          quotationId,
          masterServiceId: service.id,

          serviceCodeSnapshot: service.code,
          serviceNameSnapshot: service.name,
          serviceDescriptionSnapshot: service.description,

          categoryIdSnapshot: service.category?.id ?? null,
          categoryCodeSnapshot: service.category?.code ?? null,
          categoryNameSnapshot: service.category?.name ?? null,
          categorySortOrderSnapshot: service.category?.sortOrder ?? null,
        })),
      });
    }

    return tx.quotationServiceItem.findMany({
      where: { quotationId },
      orderBy: [
        { categorySortOrderSnapshot: "asc" },
        { serviceNameSnapshot: "asc" },
        { id: "asc" },
      ],
    });
  }

  private async getCatalogServiceOptions() {
    return this.prisma.masterService.findMany({
      where: {
        isActive: true,
      },

      select: {
        id: true,
        code: true,
        name: true,
        description: true,

        category: {
          select: {
            id: true,
            code: true,
            name: true,
            sortOrder: true,
            isActive: true,
          },
        },
      },

      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  async getCreateServiceOptions(leadId: string, actorId: string) {
    await this.validateLeadAccess(leadId, actorId, "crm.quotation.create");

    return this.getCatalogServiceOptions();
  }

  async getEditServiceOptions(quotationId: string, actorId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
      select: {
        leadId: true,
        status: true,
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!quotation) {
      throw new ApiError("Quotation tidak ditemukan.", 404);
    }

    await this.validateLeadAccess(
      quotation.leadId,
      actorId,
      "crm.quotation.update",
    );

    if (quotation.status !== "DRAFT" || quotation._count.contracts > 0) {
      throw new ApiError("Layanan quotation tidak dapat diubah.", 409);
    }

    return this.getCatalogServiceOptions();
  }
}
