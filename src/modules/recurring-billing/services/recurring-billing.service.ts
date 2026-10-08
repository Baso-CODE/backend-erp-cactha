import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CreateRecurringBillingDTO,
  QueryRecurringBillingDTO,
  UpdateRecurringBillingDTO,
} from "../dto/recurring-billing.dto";
import { RecurringBillingGeneratorService } from "./recurring-billing-generator.service";

@injectable()
export class RecurringBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
    private readonly generatorService: RecurringBillingGeneratorService,
  ) {}

  private async accessFilter(actorId: string, permission: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const where: Prisma.RecurringBillingWhereInput =
      scope === "ALL"
        ? {}
        : { contract: { client: { accountManagerId: actorId } } };

    return where;
  }

  private validateAmount(amount: string) {
    let value: Prisma.Decimal;

    try {
      value = new Prisma.Decimal(amount);
    } catch {
      throw new ApiError("Nominal billing tidak valid.", 400);
    }

    if (!value.isFinite() || value.lte(0) || value.decimalPlaces() > 2) {
      throw new ApiError(
        "Nominal harus lebih besar dari 0 dan maksimal 2 angka desimal.",
        400,
      );
    }

    if (value.gt("9999999999999.99")) {
      throw new ApiError("Nominal melebihi batas database.", 400);
    }

    return value;
  }

  private validateSchedule(date: Date, start: Date, end: Date) {
    if (Number.isNaN(date.getTime()) || date < start || date > end) {
      throw new ApiError(
        "Tanggal billing harus berada dalam periode kontrak.",
        400,
      );
    }
  }

  private async accessibleContract(
    contractId: string,
    actorId: string,
    permission: string,
  ) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    const contract = await this.prisma.contract.findFirst({
      where: {
        id: contractId,
        ...(scope !== "ALL" && {
          client: { accountManagerId: actorId },
        }),
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        currency: true,
      },
    });

    if (!contract) {
      throw new ApiError(
        "Contract tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return contract;
  }

  async getAll(query: QueryRecurringBillingDTO, actorId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const access = await this.accessFilter(actorId, "recurring_billing.read");

    const where: Prisma.RecurringBillingWhereInput = {
      AND: [
        access,
        {
          ...(query.contractId && { contractId: query.contractId }),
          ...(query.isActive !== undefined && { isActive: query.isActive }),
          ...(query.frequency && { frequency: query.frequency }),
        },
      ],
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.recurringBilling.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { nextRunDate: "asc" },
        include: {
          contract: {
            select: {
              id: true,
              contractNo: true,
              title: true,
              status: true,
              client: {
                select: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.recurringBilling.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string, actorId: string) {
    const access = await this.accessFilter(actorId, "recurring_billing.read");

    const billing = await this.prisma.recurringBilling.findFirst({
      where: { AND: [{ id }, access] },
      include: {
        contract: {
          select: {
            id: true,
            contractNo: true,
            title: true,
            status: true,
            client: {
              select: {
                id: true,
                companyName: true,
              },
            },
          },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            invoiceNo: true,
            invoiceDate: true,
            dueDate: true,
            billingPeriodStart: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    });

    if (!billing) {
      throw new ApiError("Recurring billing tidak ditemukan.", 404);
    }

    return billing;
  }

  async create(data: CreateRecurringBillingDTO, actorId: string) {
    const contract = await this.accessibleContract(
      data.contractId,
      actorId,
      "recurring_billing.create",
    );

    if (contract.status !== "ACTIVE") {
      throw new ApiError("Hanya contract ACTIVE yang dapat digunakan.", 400);
    }

    const amount = this.validateAmount(data.amount);
    const nextRunDate = new Date(data.nextRunDate);
    this.validateSchedule(nextRunDate, contract.startDate, contract.endDate);

    const currency = (data.currency ?? contract.currency).trim().toUpperCase();

    if (!/^[A-Z]{3}$/.test(currency) || currency !== contract.currency) {
      throw new ApiError(
        "Currency billing harus sama dengan currency contract.",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const billing = await tx.recurringBilling.create({
        data: {
          contractId: contract.id,
          amount,
          currency,
          frequency: data.frequency,
          nextRunDate,
          billingAnchorDay: nextRunDate.getUTCDate(),
          dueDays: data.dueDays ?? 14,
          isActive: data.isActive ?? true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "RecurringBilling",
          entityId: billing.id,
          details: {
            contractId: billing.contractId,
            amount: billing.amount.toString(),
            currency: billing.currency,
            frequency: billing.frequency,
            nextRunDate: billing.nextRunDate.toISOString(),
          },
        },
      });

      return billing;
    });
  }

  async update(id: string, data: UpdateRecurringBillingDTO, actorId: string) {
    const access = await this.accessFilter(actorId, "recurring_billing.update");

    const existing = await this.prisma.recurringBilling.findFirst({
      where: { AND: [{ id }, access] },
      include: {
        contract: {
          select: {
            status: true,
            startDate: true,
            endDate: true,
            currency: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Recurring billing tidak ditemukan.", 404);
    }

    if (existing.lastRunDate) {
      throw new ApiError(
        "Jadwal yang sudah menghasilkan billing tidak boleh diubah. Nonaktifkan jadwal ini dan buat jadwal baru.",
        409,
      );
    }

    if (existing.contract.status !== "ACTIVE") {
      throw new ApiError("Contract harus berstatus ACTIVE.", 400);
    }

    const nextRunDate = data.nextRunDate
      ? new Date(data.nextRunDate)
      : existing.nextRunDate;

    this.validateSchedule(
      nextRunDate,
      existing.contract.startDate,
      existing.contract.endDate,
    );

    const currency = (data.currency ?? existing.currency).trim().toUpperCase();

    if (
      !/^[A-Z]{3}$/.test(currency) ||
      currency !== existing.contract.currency
    ) {
      throw new ApiError(
        "Currency billing harus sama dengan currency contract.",
        400,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.recurringBilling.update({
        where: { id },
        data: {
          ...(data.amount !== undefined && {
            amount: this.validateAmount(data.amount),
          }),
          ...(data.nextRunDate !== undefined && {
            billingAnchorDay: nextRunDate.getUTCDate(),
          }),
          currency,
          ...(data.frequency !== undefined && {
            frequency: data.frequency,
          }),
          nextRunDate,
          ...(data.dueDays !== undefined && { dueDays: data.dueDays }),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "RecurringBilling",
          entityId: id,
          details: {
            before: {
              amount: existing.amount.toString(),
              frequency: existing.frequency,
              nextRunDate: existing.nextRunDate.toISOString(),
              dueDays: existing.dueDays,
            },
            after: {
              amount: updated.amount.toString(),
              frequency: updated.frequency,
              nextRunDate: updated.nextRunDate.toISOString(),
              dueDays: updated.dueDays,
            },
          },
        },
      });

      return updated;
    });
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    const access = await this.accessFilter(actorId, "recurring_billing.update");

    const existing = await this.prisma.recurringBilling.findFirst({
      where: { AND: [{ id }, access] },
      include: {
        contract: {
          select: {
            status: true,
            endDate: true,
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError("Recurring billing tidak ditemukan.", 404);
    }

    if (isActive) {
      if (existing.contract.status !== "ACTIVE") {
        throw new ApiError("Contract harus berstatus ACTIVE.", 400);
      }

      if (existing.nextRunDate > existing.contract.endDate) {
        throw new ApiError(
          "Jadwal billing sudah melewati tanggal akhir kontrak.",
          400,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.recurringBilling.update({
        where: { id },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: isActive ? "ACTIVATE" : "DEACTIVATE",
          entity: "RecurringBilling",
          entityId: id,
          details: { isActive },
        },
      });

      return updated;
    });
  }

  async generateInvoice(id: string, actorId: string) {
    const access = await this.accessFilter(actorId, "recurring_billing.update");

    const invoiceScope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.create",
    );

    const where: Prisma.RecurringBillingWhereInput = {
      AND: [
        { id },
        access,
        ...(invoiceScope === "ALL"
          ? []
          : [{ contract: { client: { accountManagerId: actorId } } }]),
      ],
    };

    const billing = await this.prisma.recurringBilling.findFirst({
      where,
      select: { id: true },
    });

    if (!billing) {
      throw new ApiError(
        "Recurring billing tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return this.generatorService.generateInvoice(billing.id);
  }
}
