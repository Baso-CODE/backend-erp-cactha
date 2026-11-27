import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { CreateContractDTO } from "./dto/create-contract.dto";
import { QueryContractDTO } from "./dto/query-contract.dto";
import { UpdateContractDTO } from "./dto/update-contract.dto";

import {
  CONTRACT_SERVICE_ITEMS_INCLUDE,
  CONTRACT_SERVICE_SNAPSHOT_SELECT,
} from "./contract-service-items.helper";
@injectable()
export class ContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async getAccessibleClient(
    clientId: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const client = await this.prisma.client.findFirst({
      where: {
        id: clientId,
        ...(scope !== "ALL" && {
          accountManagerId: actorId,
        }),
      },
      select: {
        id: true,
        clientCode: true,
        companyName: true,
        accountManagerId: true,
        status: true,
      },
    });

    if (!client) {
      throw new Error("Client tidak ditemukan atau Anda tidak memiliki akses.");
    }

    return client;
  }

  private async validateQuotation(
    quotationId: string,
    clientId: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    const quotation = await db.quotation.findUnique({
      where: {
        id: quotationId,
      },
      select: {
        id: true,
        quotationNo: true,
        amount: true,
        status: true,
        leadId: true,
      },
    });

    if (!quotation) {
      throw new ApiError("Quotation tidak ditemukan.", 404);
    }

    const client = await db.client.findUnique({
      where: {
        id: clientId,
      },
      select: {
        id: true,
        sourceLeadId: true,
      },
    });

    if (!client) {
      throw new ApiError("Client tidak ditemukan.", 404);
    }

    if (!client.sourceLeadId || quotation.leadId !== client.sourceLeadId) {
      throw new ApiError(
        "Quotation tidak berasal dari lead yang membentuk client ini.",
        400,
      );
    }

    return quotation;
  }

  private validateContractDates(startDate: Date, endDate: Date) {
    if (endDate <= startDate) {
      throw new Error("End date harus lebih besar dari start date.");
    }
  }

  async getAllContracts(query: QueryContractDTO, actorId: string) {
    const {
      clientId,
      quotationId,
      status,
      search,
      page = 1,
      limit = 10,
    } = query;

    const skip = (page - 1) * limit;

    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "contract.read",
    );

    const accessFilter: Prisma.ContractWhereInput =
      scope === "ALL"
        ? {}
        : {
            client: {
              accountManagerId: actorId,
            },
          };

    const where: Prisma.ContractWhereInput = {
      AND: [
        accessFilter,
        {
          ...(clientId && {
            clientId,
          }),
          ...(quotationId && {
            quotationId,
          }),
          ...(status && {
            status,
          }),
          ...(search && {
            OR: [
              {
                contractNo: {
                  contains: search,
                },
              },
              {
                title: {
                  contains: search,
                },
              },
              {
                contractType: {
                  contains: search,
                },
              },
              {
                client: {
                  companyName: {
                    contains: search,
                  },
                },
              },
            ],
          }),
        },
      ],
    };

    const [contracts, total] = await this.prisma.$transaction([
      this.prisma.contract.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          serviceItems: CONTRACT_SERVICE_ITEMS_INCLUDE,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
              status: true,
              accountManager: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          quotation: {
            select: {
              id: true,
              quotationNo: true,
              amount: true,
              status: true,
            },
          },
          _count: {
            select: {
              projects: true,
              recurringBillings: true,
              attachments: true,
            },
          },
        },
      }),

      this.prisma.contract.count({
        where,
      }),
    ]);

    return {
      data: contracts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getContractById(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "contract.read",
    );

    const contract = await this.prisma.contract.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        serviceItems: CONTRACT_SERVICE_ITEMS_INCLUDE,
        client: {
          select: {
            id: true,
            clientCode: true,
            companyName: true,
            industry: true,
            businessType: true,
            status: true,
            accountManager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        quotation: {
          select: {
            id: true,
            quotationNo: true,
            amount: true,
            status: true,
          },
        },
        attachments: {
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            projects: true,
            recurringBillings: true,
            attachments: true,
          },
        },
      },
    });

    if (!contract) {
      throw new Error(
        "Contract tidak ditemukan atau Anda tidak memiliki akses.",
      );
    }

    return contract;
  }

  async createContract(data: CreateContractDTO, actorId: string) {
    await this.getAccessibleClient(data.clientId, actorId, "contract.create");

    this.validateContractDates(data.startDate, data.endDate);

    return this.prisma.$transaction(async (tx) => {
      let serviceItems: Prisma.QuotationServiceItemGetPayload<{
        select: typeof CONTRACT_SERVICE_SNAPSHOT_SELECT;
      }>[] = [];

      if (data.quotationId) {
        // Sinkron dengan row lock pada updateQuotation().
        await tx.$queryRaw`
        SELECT "id"
        FROM "Quotation"
        WHERE "id" = ${data.quotationId}
        FOR UPDATE
      `;

        const quotation = await this.validateQuotation(
          data.quotationId,
          data.clientId,
          tx,
        );

        if (quotation.status !== "APPROVED") {
          throw new ApiError(
            "Hanya quotation Approved yang dapat digunakan untuk membuat contract.",
            409,
          );
        }

        serviceItems = await tx.quotationServiceItem.findMany({
          where: {
            quotationId: quotation.id,
          },
          select: CONTRACT_SERVICE_SNAPSHOT_SELECT,
        });
      }

      const counter = await tx.counter.upsert({
        where: {
          key: "CONTRACT",
        },
        update: {
          value: {
            increment: 1,
          },
        },
        create: {
          key: "CONTRACT",
          value: 1,
        },
      });

      const contractNo = `CTR-${String(counter.value).padStart(6, "0")}`;

      const contract = await tx.contract.create({
        data: {
          contractNo,
          title: data.title,
          clientId: data.clientId,
          quotationId: data.quotationId,
          contractType: data.contractType,
          startDate: data.startDate,
          endDate: data.endDate,
          value: new Prisma.Decimal(data.value),
          currency: data.currency ?? "IDR",
          paymentTerm: data.paymentTerm,
          slaTerms: data.slaTerms,
          termsConditions: data.termsConditions,
          documentUrl: data.documentUrl,
          status: data.status ?? "DRAFT",
          renewalReminder: data.renewalReminder ?? false,

          serviceItems: {
            create: serviceItems,
          },
        },

        include: {
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },

          quotation: {
            select: {
              id: true,
              quotationNo: true,
              amount: true,
              status: true,
            },
          },

          serviceItems: CONTRACT_SERVICE_ITEMS_INCLUDE,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "Contract",
          entityId: contract.id,
          details: {
            contractNo: contract.contractNo,
            title: contract.title,
            clientId: contract.clientId,
            quotationId: contract.quotationId,
            value: contract.value.toString(),
            currency: contract.currency,
            status: contract.status,

            serviceItems: contract.serviceItems.map((item) => ({
              masterServiceId: item.masterServiceId,
              name: item.serviceNameSnapshot,
              category: item.categoryNameSnapshot,
            })),
          },
        },
      });

      return contract;
    });
  }

  async updateContract(id: string, data: UpdateContractDTO, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "contract.update",
    );

    const existing = await this.prisma.contract.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
    });

    if (!existing) {
      throw new Error(
        "Contract tidak ditemukan atau Anda tidak memiliki akses.",
      );
    }

    if (
      data.quotationId !== undefined &&
      data.quotationId !== existing.quotationId
    ) {
      throw new ApiError(
        "Quotation sumber contract tidak dapat diubah setelah contract dibuat.",
        409,
      );
    }

    if (data.clientId !== undefined && data.clientId !== existing.clientId) {
      throw new ApiError(
        "Client contract tidak dapat dipindahkan setelah contract dibuat.",
        409,
      );
    }

    if (data.clientId !== undefined && data.clientId !== existing.clientId) {
      await this.getAccessibleClient(data.clientId, actorId, "contract.update");
    }
    const targetClientId = data.clientId ?? existing.clientId;

    const targetQuotationId = data.quotationId ?? existing.quotationId;

    if (targetQuotationId) {
      await this.validateQuotation(targetQuotationId, targetClientId);
    }

    const startDate = data.startDate ?? existing.startDate;

    const endDate = data.endDate ?? existing.endDate;

    this.validateContractDates(startDate, endDate);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: {
          id,
        },
        data: {
          ...(data.title !== undefined && {
            title: data.title,
          }),
          ...(data.contractType !== undefined && {
            contractType: data.contractType,
          }),
          ...(data.startDate !== undefined && {
            startDate: data.startDate,
          }),
          ...(data.endDate !== undefined && {
            endDate: data.endDate,
          }),
          ...(data.value !== undefined && {
            value: new Prisma.Decimal(data.value),
          }),
          ...(data.currency !== undefined && {
            currency: data.currency,
          }),
          ...(data.paymentTerm !== undefined && {
            paymentTerm: data.paymentTerm,
          }),
          ...(data.slaTerms !== undefined && {
            slaTerms: data.slaTerms,
          }),
          ...(data.termsConditions !== undefined && {
            termsConditions: data.termsConditions,
          }),
          ...(data.documentUrl !== undefined && {
            documentUrl: data.documentUrl,
          }),
          ...(data.status !== undefined && {
            status: data.status,
          }),
          ...(data.renewalReminder !== undefined && {
            renewalReminder: data.renewalReminder,
          }),
        },
        include: {
          serviceItems: CONTRACT_SERVICE_ITEMS_INCLUDE,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          quotation: {
            select: {
              id: true,
              quotationNo: true,
              amount: true,
              status: true,
            },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "Contract",
          entityId: id,
          details: {
            before: {
              title: existing.title,
              clientId: existing.clientId,
              quotationId: existing.quotationId,
              contractType: existing.contractType,
              startDate: existing.startDate,
              endDate: existing.endDate,
              value: existing.value.toString(),
              currency: existing.currency,
              paymentTerm: existing.paymentTerm,
              status: existing.status,
              renewalReminder: existing.renewalReminder,
            },
            after: {
              title: updated.title,
              clientId: updated.clientId,
              quotationId: updated.quotationId,
              contractType: updated.contractType,
              startDate: updated.startDate,
              endDate: updated.endDate,
              value: updated.value.toString(),
              currency: updated.currency,
              paymentTerm: updated.paymentTerm,
              status: updated.status,
              renewalReminder: updated.renewalReminder,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteContract(id: string, actorId: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "contract.delete",
    );

    const existing = await this.prisma.contract.findFirst({
      where: {
        id,
        ...(scope !== "ALL" && {
          client: {
            accountManagerId: actorId,
          },
        }),
      },
      include: {
        _count: {
          select: {
            projects: true,
            recurringBillings: true,
            attachments: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error(
        "Contract tidak ditemukan atau Anda tidak memiliki akses.",
      );
    }

    const hasRelatedData =
      existing._count.projects > 0 ||
      existing._count.recurringBillings > 0 ||
      existing._count.attachments > 0;

    if (hasRelatedData) {
      throw new Error(
        "Contract tidak dapat dihapus karena sudah memiliki data terkait.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contract.delete({
        where: {
          id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "Contract",
          entityId: id,
          details: {
            contractNo: existing.contractNo,
            title: existing.title,
            clientId: existing.clientId,
            quotationId: existing.quotationId,
            value: existing.value.toString(),
            currency: existing.currency,
            status: existing.status,
          },
        },
      });
    });

    return {
      message: `Contract "${existing.contractNo}" berhasil dihapus.`,
    };
  }
}
