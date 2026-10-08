import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../helpers/access-scope.service";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateProjectBudgetDTO,
  QueryProjectBudgetDTO,
  UpdateProjectBudgetDTO,
} from "./dto/project-budget.dto";
import {
  CreateProjectCostDTO,
  QueryProjectCostDTO,
  UpdateProjectCostDTO,
} from "./dto/project-cost.dto";
import { QueryProjectProfitabilityDTO } from "./dto/query-project-profitability.dto";
import { SaveRevenueAllocationsDTO } from "./dto/revenue-allocation.dto";

@injectable()
export class ProfitabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private async projectAccess(actorId: string, permission: string) {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      permission,
    );

    if (scope === "ALL") return {};
    if (scope === "OWN" || scope === "PROJECT") {
      return { projectManagerId: actorId };
    }
    if (scope === "TEAM") {
      const memberIds = await this.accessScopeService.getTeamMemberIds(actorId);
      return { projectManagerId: { in: memberIds } };
    }

    throw new ApiError(`Scope ${scope} belum didukung.`, 403);
  }

  private async getProject(
    projectId: string,
    actorId: string,
    permission: string,
  ) {
    const access = await this.projectAccess(actorId, permission);

    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...access },
      select: {
        id: true,
        projectCode: true,
        name: true,
        contract: {
          select: { currency: true },
        },
      },
    });

    if (!project) {
      throw new ApiError(
        "Project tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return project;
  }

  private async validateProjectService(
    projectId: string,
    projectServiceId?: string,
  ) {
    if (!projectServiceId) return;

    const service = await this.prisma.projectService.findFirst({
      where: { id: projectServiceId, projectId },
      select: { id: true },
    });

    if (!service) {
      throw new ApiError(
        "Project Service tidak ditemukan pada Project ini.",
        400,
      );
    }
  }

  private validateAmount(value: string) {
    let amount: Prisma.Decimal;

    try {
      amount = new Prisma.Decimal(value);
    } catch {
      throw new ApiError("Nominal anggaran tidak valid.", 400);
    }

    if (
      !amount.isFinite() ||
      amount.lte(0) ||
      amount.decimalPlaces() > 2 ||
      amount.gt("9999999999999.99")
    ) {
      throw new ApiError(
        "Nominal harus lebih besar dari 0 dan maksimal 2 desimal.",
        400,
      );
    }

    return amount;
  }

  private validateCurrency(
    currency: string | undefined,
    contractCurrency: string | undefined,
  ) {
    const value = currency ?? contractCurrency;

    if (!value) {
      throw new ApiError(
        "Project belum memiliki Contract. Currency harus diisi.",
        400,
      );
    }

    if (!/^[A-Z]{3}$/.test(value)) {
      throw new ApiError("Format currency tidak valid.", 400);
    }

    if (contractCurrency && value !== contractCurrency) {
      throw new ApiError("Currency harus sama dengan currency Contract.", 400);
    }

    return value;
  }

  async getBudgets(query: QueryProjectBudgetDTO, actorId: string) {
    const access = await this.projectAccess(actorId, "project.read");
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProjectBudgetWhereInput = {
      project: {
        ...access,
        ...(query.projectId && { id: query.projectId }),
      },
      ...(query.projectServiceId && {
        projectServiceId: query.projectServiceId,
      }),
      ...(query.category && { category: query.category }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.projectBudget.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          projectService: {
            select: {
              id: true,
              masterService: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.projectBudget.count({ where }),
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

  async getBudgetById(id: string, actorId: string) {
    const access = await this.projectAccess(actorId, "project.read");

    const budget = await this.prisma.projectBudget.findFirst({
      where: { id, project: access },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        projectService: {
          include: {
            masterService: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!budget) {
      throw new ApiError(
        "Budget tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return budget;
  }

  async createBudget(data: CreateProjectBudgetDTO, actorId: string) {
    const project = await this.getProject(
      data.projectId,
      actorId,
      "project.update",
    );

    await this.validateProjectService(project.id, data.projectServiceId);

    const amount = this.validateAmount(data.amount);
    const currency = this.validateCurrency(
      data.currency,
      project.contract?.currency,
    );

    return this.prisma.$transaction(async (tx) => {
      const budget = await tx.projectBudget.create({
        data: {
          projectId: project.id,
          projectServiceId: data.projectServiceId,
          category: data.category,
          description: data.description.trim(),
          amount,
          currency,
          notes: data.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "ProjectBudget",
          entityId: budget.id,
          details: {
            projectId: budget.projectId,
            projectServiceId: budget.projectServiceId,
            category: budget.category,
            amount: budget.amount.toString(),
            currency: budget.currency,
          },
        },
      });

      return budget;
    });
  }

  async updateBudget(
    id: string,
    data: UpdateProjectBudgetDTO,
    actorId: string,
  ) {
    const access = await this.projectAccess(actorId, "project.update");

    const existing = await this.prisma.projectBudget.findFirst({
      where: { id, project: access },
      include: {
        project: {
          select: {
            contract: { select: { currency: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(
        "Budget tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    await this.validateProjectService(
      existing.projectId,
      data.projectServiceId,
    );

    const amount =
      data.amount !== undefined
        ? this.validateAmount(data.amount)
        : existing.amount;

    const currency = this.validateCurrency(
      data.currency ?? existing.currency,
      existing.project.contract?.currency,
    );

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.projectBudget.updateMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
        },
        data: {
          ...(data.projectServiceId !== undefined && {
            projectServiceId: data.projectServiceId,
          }),
          ...(data.category !== undefined && {
            category: data.category,
          }),
          ...(data.description !== undefined && {
            description: data.description.trim(),
          }),
          amount,
          currency,
          ...(data.notes !== undefined && { notes: data.notes }),
        },
      });

      if (result.count !== 1) {
        throw new ApiError(
          "Budget sudah diubah oleh proses lain. Muat ulang data.",
          409,
        );
      }

      const updated = await tx.projectBudget.findUniqueOrThrow({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "ProjectBudget",
          entityId: id,
          details: {
            projectId: updated.projectId,
            before: {
              amount: existing.amount.toString(),
              currency: existing.currency,
              category: existing.category,
            },
            after: {
              amount: updated.amount.toString(),
              currency: updated.currency,
              category: updated.category,
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteBudget(id: string, actorId: string) {
    const access = await this.projectAccess(actorId, "project.update");

    const existing = await this.prisma.projectBudget.findFirst({
      where: { id, project: access },
    });

    if (!existing) {
      throw new ApiError(
        "Budget tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.projectBudget.deleteMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
        },
      });

      if (deleted.count !== 1) {
        throw new ApiError(
          "Budget sudah berubah atau dihapus. Muat ulang data.",
          409,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "ProjectBudget",
          entityId: id,
          details: {
            projectId: existing.projectId,
            category: existing.category,
            amount: existing.amount.toString(),
            currency: existing.currency,
            description: existing.description,
          },
        },
      });

      return { id, deleted: true };
    });
  }

  async getCosts(query: QueryProjectCostDTO, actorId: string) {
    const access = await this.projectAccess(actorId, "project.read");
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    if (query.startDate && query.endDate && query.startDate > query.endDate) {
      throw new ApiError(
        "Tanggal mulai tidak boleh setelah tanggal akhir.",
        400,
      );
    }

    const where: Prisma.ProjectCostWhereInput = {
      project: {
        ...access,
        ...(query.projectId && { id: query.projectId }),
      },
      ...(query.projectServiceId && {
        projectServiceId: query.projectServiceId,
      }),
      ...(query.category && { category: query.category }),
      ...((query.startDate || query.endDate) && {
        costDate: {
          ...(query.startDate && { gte: query.startDate }),
          ...(query.endDate && { lte: query.endDate }),
        },
      }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.projectCost.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ costDate: "desc" }, { id: "desc" }],
        include: {
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
          projectService: {
            select: {
              id: true,
              masterService: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.projectCost.count({ where }),
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

  async getCostById(id: string, actorId: string) {
    const access = await this.projectAccess(actorId, "project.read");

    const cost = await this.prisma.projectCost.findFirst({
      where: { id, project: access },
      include: {
        project: {
          select: {
            id: true,
            projectCode: true,
            name: true,
          },
        },
        projectService: {
          include: {
            masterService: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!cost) {
      throw new ApiError(
        "Biaya tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return cost;
  }

  async createCost(data: CreateProjectCostDTO, actorId: string) {
    const project = await this.getProject(
      data.projectId,
      actorId,
      "project.update",
    );

    await this.validateProjectService(project.id, data.projectServiceId);

    const amount = this.validateAmount(data.amount);
    const currency = this.validateCurrency(
      data.currency,
      project.contract?.currency,
    );

    return this.prisma.$transaction(async (tx) => {
      const cost = await tx.projectCost.create({
        data: {
          projectId: project.id,
          projectServiceId: data.projectServiceId,
          category: data.category,
          description: data.description.trim(),
          amount,
          currency,
          costDate: data.costDate,
          reference: data.reference,
          notes: data.notes,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "CREATE",
          entity: "ProjectCost",
          entityId: cost.id,
          details: {
            projectId: cost.projectId,
            projectServiceId: cost.projectServiceId,
            category: cost.category,
            amount: cost.amount.toString(),
            currency: cost.currency,
            costDate: cost.costDate.toISOString(),
          },
        },
      });

      return cost;
    });
  }

  async updateCost(id: string, data: UpdateProjectCostDTO, actorId: string) {
    const access = await this.projectAccess(actorId, "project.update");

    const existing = await this.prisma.projectCost.findFirst({
      where: { id, project: access },
      include: {
        project: {
          select: {
            contract: { select: { currency: true } },
          },
        },
      },
    });

    if (!existing) {
      throw new ApiError(
        "Biaya tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    await this.validateProjectService(
      existing.projectId,
      data.projectServiceId,
    );

    const amount =
      data.amount !== undefined
        ? this.validateAmount(data.amount)
        : existing.amount;

    const currency = this.validateCurrency(
      data.currency ?? existing.currency,
      existing.project.contract?.currency,
    );

    return this.prisma.$transaction(async (tx) => {
      const result = await tx.projectCost.updateMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
        },
        data: {
          ...(data.projectServiceId !== undefined && {
            projectServiceId: data.projectServiceId,
          }),
          ...(data.category !== undefined && {
            category: data.category,
          }),
          ...(data.description !== undefined && {
            description: data.description.trim(),
          }),
          amount,
          currency,
          ...(data.costDate !== undefined && {
            costDate: data.costDate,
          }),
          ...(data.reference !== undefined && {
            reference: data.reference,
          }),
          ...(data.notes !== undefined && {
            notes: data.notes,
          }),
        },
      });

      if (result.count !== 1) {
        throw new ApiError(
          "Data biaya sudah diubah oleh proses lain. Muat ulang data.",
          409,
        );
      }

      const updated = await tx.projectCost.findUniqueOrThrow({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "UPDATE",
          entity: "ProjectCost",
          entityId: id,
          details: {
            projectId: updated.projectId,
            before: {
              amount: existing.amount.toString(),
              currency: existing.currency,
              category: existing.category,
              costDate: existing.costDate.toISOString(),
            },
            after: {
              amount: updated.amount.toString(),
              currency: updated.currency,
              category: updated.category,
              costDate: updated.costDate.toISOString(),
            },
          },
        },
      });

      return updated;
    });
  }

  async deleteCost(id: string, actorId: string) {
    const access = await this.projectAccess(actorId, "project.update");

    const existing = await this.prisma.projectCost.findFirst({
      where: { id, project: access },
    });

    if (!existing) {
      throw new ApiError(
        "Biaya tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.projectCost.deleteMany({
        where: {
          id,
          updatedAt: existing.updatedAt,
        },
      });

      if (deleted.count !== 1) {
        throw new ApiError(
          "Biaya sudah berubah atau dihapus. Muat ulang data.",
          409,
        );
      }

      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: "DELETE",
          entity: "ProjectCost",
          entityId: id,
          details: {
            projectId: existing.projectId,
            category: existing.category,
            description: existing.description,
            amount: existing.amount.toString(),
            currency: existing.currency,
            costDate: existing.costDate.toISOString(),
          },
        },
      });

      return { id, deleted: true };
    });
  }

  async getProjectProfitability(projectId: string, actorId: string) {
    const project = await this.getProject(
      projectId,
      actorId,
      "profitability.read",
    );

    const [budgets, costs, invoices] = await this.prisma.$transaction([
      this.prisma.projectBudget.findMany({
        where: { projectId },
        select: { amount: true, currency: true },
      }),
      this.prisma.projectCost.findMany({
        where: { projectId },
        select: { amount: true, currency: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          projectId,
          status: {
            in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
          },
        },
        select: {
          id: true,
          currency: true,
          subtotal: true,
          discountAmount: true,
          payments: {
            where: { status: "VERIFIED" },
            select: { amountPaid: true },
          },
        },
      }),
    ]);

    for (const invoice of invoices) {
      if (invoice.discountAmount.gt(invoice.subtotal)) {
        throw new ApiError(
          "Terdapat Invoice dengan discount melebihi subtotal.",
          409,
        );
      }
    }

    const currencies = new Set([
      ...budgets.map((item) => item.currency),
      ...costs.map((item) => item.currency),
      ...invoices.map((item) => item.currency),
    ]);

    const contractCurrency = project.contract?.currency;

    if (contractCurrency) currencies.add(contractCurrency);

    if (currencies.size > 1) {
      throw new ApiError(
        "Project memiliki lebih dari satu currency. Profitability belum mendukung konversi kurs.",
        409,
      );
    }

    const currency = [...currencies][0] ?? null;
    const zero = new Prisma.Decimal(0);

    const totalBudget = budgets.reduce(
      (sum, item) => sum.plus(item.amount),
      zero,
    );

    const actualCost = costs.reduce((sum, item) => sum.plus(item.amount), zero);

    const netRevenue = invoices.reduce(
      (sum, invoice) =>
        sum.plus(invoice.subtotal.minus(invoice.discountAmount)),
      zero,
    );

    const verifiedPayments = invoices.reduce(
      (sum, invoice) =>
        sum.plus(
          invoice.payments.reduce(
            (paymentSum, payment) => paymentSum.plus(payment.amountPaid),
            zero,
          ),
        ),
      zero,
    );

    const budgetVariance = totalBudget.minus(actualCost);
    const grossProfit = netRevenue.minus(actualCost);

    const grossMargin = netRevenue.gt(0)
      ? grossProfit.div(netRevenue).mul(100)
      : null;

    const budgetUtilization = totalBudget.gt(0)
      ? actualCost.div(totalBudget).mul(100)
      : null;

    return {
      project: {
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
      },
      currency,
      summary: {
        totalBudget: totalBudget.toFixed(2),
        actualCost: actualCost.toFixed(2),
        budgetVariance: budgetVariance.toFixed(2),
        budgetUtilizationPercent:
          budgetUtilization?.toDecimalPlaces(2).toFixed(2) ?? null,
        netRevenue: netRevenue.toFixed(2),
        verifiedPayments: verifiedPayments.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: grossMargin?.toDecimalPlaces(2).toFixed(2) ?? null,
      },
      counts: {
        budgets: budgets.length,
        costs: costs.length,
        invoices: invoices.length,
      },
    };
  }

  async getProjectServiceProfitability(projectId: string, actorId: string) {
    const project = await this.getProject(
      projectId,
      actorId,
      "profitability.read",
    );

    const [services, budgets, costs, invoices] = await this.prisma.$transaction(
      [
        this.prisma.projectService.findMany({
          where: { projectId },
          select: {
            id: true,
            status: true,
            masterService: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
        this.prisma.projectBudget.findMany({
          where: { projectId },
          select: {
            projectServiceId: true,
            amount: true,
            currency: true,
          },
        }),
        this.prisma.projectCost.findMany({
          where: { projectId },
          select: {
            projectServiceId: true,
            amount: true,
            currency: true,
          },
        }),
        this.prisma.invoice.findMany({
          where: {
            projectId,
            status: {
              in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
            },
          },
          select: {
            id: true,
            invoiceNo: true,
            currency: true,
            subtotal: true,
            discountAmount: true,
            revenueAllocations: {
              select: {
                projectServiceId: true,
                amount: true,
              },
            },
          },
        }),
      ],
    );

    const currencies = new Set([
      ...budgets.map((item) => item.currency),
      ...costs.map((item) => item.currency),
      ...invoices.map((item) => item.currency),
    ]);

    if (project.contract?.currency) {
      currencies.add(project.contract.currency);
    }

    if (currencies.size > 1) {
      throw new ApiError(
        "Project memiliki beberapa currency. Konversi kurs belum didukung.",
        409,
      );
    }

    const currency = [...currencies][0] ?? null;
    const zero = new Prisma.Decimal(0);

    const totalBudget = budgets.reduce(
      (sum, item) => sum.plus(item.amount),
      zero,
    );

    const totalActualCost = costs.reduce(
      (sum, item) => sum.plus(item.amount),
      zero,
    );

    const totalNetRevenue = invoices.reduce(
      (sum, invoice) =>
        sum.plus(invoice.subtotal.minus(invoice.discountAmount)),
      zero,
    );

    const allocatedByService = new Map<string, Prisma.Decimal>();
    let totalAllocatedRevenue = zero;

    for (const invoice of invoices) {
      const netRevenue = invoice.subtotal.minus(invoice.discountAmount);
      const invoiceAllocated = invoice.revenueAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.amount),
        zero,
      );

      if (netRevenue.lt(0) || invoiceAllocated.gt(netRevenue)) {
        throw new ApiError(
          `Revenue allocation invoice ${invoice.invoiceNo} tidak valid.`,
          409,
        );
      }

      totalAllocatedRevenue = totalAllocatedRevenue.plus(invoiceAllocated);

      for (const allocation of invoice.revenueAllocations) {
        const previous =
          allocatedByService.get(allocation.projectServiceId) ?? zero;

        allocatedByService.set(
          allocation.projectServiceId,
          previous.plus(allocation.amount),
        );
      }
    }

    const calculateCosts = (projectServiceId: string | null) => {
      const budget = budgets.reduce(
        (sum, item) =>
          item.projectServiceId === projectServiceId
            ? sum.plus(item.amount)
            : sum,
        zero,
      );

      const actual = costs.reduce(
        (sum, item) =>
          item.projectServiceId === projectServiceId
            ? sum.plus(item.amount)
            : sum,
        zero,
      );

      return { budget, actual };
    };

    const serviceIds = new Set(services.map((service) => service.id));

    for (const serviceId of allocatedByService.keys()) {
      if (!serviceIds.has(serviceId)) {
        throw new ApiError(
          "Terdapat revenue allocation pada Service yang tidak terdaftar di Project.",
          409,
        );
      }
    }

    const data = services.map((service) => {
      const { budget, actual } = calculateCosts(service.id);
      const revenue = allocatedByService.get(service.id) ?? zero;

      const variance = budget.minus(actual);
      const grossProfit = revenue.minus(actual);

      return {
        projectServiceId: service.id,
        masterServiceId: service.masterService.id,
        serviceName: service.masterService.name,
        status: service.status,
        totalBudget: budget.toFixed(2),
        actualCost: actual.toFixed(2),
        variance: variance.toFixed(2),
        utilizationPercent: budget.gt(0)
          ? actual.div(budget).mul(100).toFixed(2)
          : null,
        allocatedRevenue: revenue.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: revenue.gt(0)
          ? grossProfit.div(revenue).mul(100).toFixed(2)
          : null,
      };
    });

    const commonCosts = calculateCosts(null);
    const unallocatedRevenue = totalNetRevenue.minus(totalAllocatedRevenue);
    const totalGrossProfit = totalNetRevenue.minus(totalActualCost);

    return {
      project: {
        id: project.id,
        projectCode: project.projectCode,
        name: project.name,
      },
      currency,
      services: data,
      unallocated: {
        label: "Belum dialokasikan / Biaya umum Project",
        totalBudget: commonCosts.budget.toFixed(2),
        actualCost: commonCosts.actual.toFixed(2),
        variance: commonCosts.budget.minus(commonCosts.actual).toFixed(2),
        utilizationPercent: commonCosts.budget.gt(0)
          ? commonCosts.actual.div(commonCosts.budget).mul(100).toFixed(2)
          : null,
        unallocatedRevenue: unallocatedRevenue.toFixed(2),
      },
      summary: {
        totalBudget: totalBudget.toFixed(2),
        actualCost: totalActualCost.toFixed(2),
        budgetVariance: totalBudget.minus(totalActualCost).toFixed(2),
        budgetUtilizationPercent: totalBudget.gt(0)
          ? totalActualCost.div(totalBudget).mul(100).toFixed(2)
          : null,
        netRevenue: totalNetRevenue.toFixed(2),
        allocatedRevenue: totalAllocatedRevenue.toFixed(2),
        unallocatedRevenue: unallocatedRevenue.toFixed(2),
        grossProfit: totalGrossProfit.toFixed(2),
        grossMarginPercent: totalNetRevenue.gt(0)
          ? totalGrossProfit.div(totalNetRevenue).mul(100).toFixed(2)
          : null,
      },
      counts: {
        services: services.length,
        invoices: invoices.length,
        budgets: budgets.length,
        costs: costs.length,
      },
    };
  }

  async getProjectsProfitability(
    query: QueryProjectProfitabilityDTO,
    actorId: string,
  ) {
    const access = await this.projectAccess(actorId, "profitability.read");

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const where: Prisma.ProjectWhereInput = {
      ...access,
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.status && { status: query.status }),
      ...(query.search?.trim() && {
        OR: [
          { name: { contains: query.search.trim() } },
          { projectCode: { contains: query.search.trim() } },
        ],
      }),
    };

    const [projects, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          projectCode: true,
          name: true,
          status: true,
          client: {
            select: { id: true, companyName: true },
          },
          contract: {
            select: { currency: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    const projectIds = projects.map((project) => project.id);
    const zero = new Prisma.Decimal(0);

    if (projectIds.length === 0) {
      return {
        data: [],
        pageSummary: [],
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const [budgets, costs, invoices] = await this.prisma.$transaction([
      this.prisma.projectBudget.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          amount: true,
          currency: true,
        },
      }),
      this.prisma.projectCost.findMany({
        where: { projectId: { in: projectIds } },
        select: {
          projectId: true,
          amount: true,
          currency: true,
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          projectId: { in: projectIds },
          status: {
            in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
          },
        },
        select: {
          projectId: true,
          subtotal: true,
          discountAmount: true,
          currency: true,
          payments: {
            where: { status: "VERIFIED" },
            select: { amountPaid: true },
          },
        },
      }),
    ]);

    for (const invoice of invoices) {
      if (invoice.discountAmount.gt(invoice.subtotal)) {
        throw new ApiError(
          "Terdapat Invoice dengan discount melebihi subtotal.",
          409,
        );
      }
    }

    const sumForProject = (
      items: { projectId: string; amount: Prisma.Decimal }[],
      projectId: string,
    ) =>
      items.reduce(
        (sum, item) =>
          item.projectId === projectId ? sum.plus(item.amount) : sum,
        zero,
      );

    const budgetAmounts = budgets.map((item) => ({
      projectId: item.projectId,
      amount: item.amount,
    }));

    const costAmounts = costs.map((item) => ({
      projectId: item.projectId,
      amount: item.amount,
    }));

    const data = projects.map((project) => {
      const projectInvoices = invoices.filter(
        (invoice) => invoice.projectId === project.id,
      );

      const currencies = new Set([
        ...(project.contract?.currency ? [project.contract.currency] : []),
        ...budgets
          .filter((item) => item.projectId === project.id)
          .map((item) => item.currency),
        ...costs
          .filter((item) => item.projectId === project.id)
          .map((item) => item.currency),
        ...projectInvoices.map((item) => item.currency),
      ]);

      if (currencies.size > 1) {
        throw new ApiError(
          `Project ${project.projectCode} memiliki currency berbeda.`,
          409,
        );
      }

      const currency = [...currencies][0] ?? null;

      const totalBudget = sumForProject(budgetAmounts, project.id);

      const actualCost = sumForProject(costAmounts, project.id);

      const netRevenue = projectInvoices.reduce(
        (sum, invoice) =>
          sum.plus(invoice.subtotal.minus(invoice.discountAmount)),
        zero,
      );

      if (netRevenue.lt(0)) {
        throw new ApiError(
          `Net revenue Project ${project.projectCode} tidak valid.`,
          409,
        );
      }

      const verifiedPayments = projectInvoices.reduce(
        (sum, invoice) =>
          sum.plus(
            invoice.payments.reduce(
              (paymentSum, payment) => paymentSum.plus(payment.amountPaid),
              zero,
            ),
          ),
        zero,
      );

      const grossProfit = netRevenue.minus(actualCost);
      return {
        project: {
          id: project.id,
          projectCode: project.projectCode,
          name: project.name,
          status: project.status,
          client: project.client,
        },
        currency,
        totalBudget: totalBudget.toFixed(2),
        actualCost: actualCost.toFixed(2),
        budgetVariance: totalBudget.minus(actualCost).toFixed(2),
        budgetUtilizationPercent: totalBudget.gt(0)
          ? actualCost.div(totalBudget).mul(100).toFixed(2)
          : null,
        netRevenue: netRevenue.toFixed(2),
        verifiedPayments: verifiedPayments.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: netRevenue.gt(0)
          ? grossProfit.div(netRevenue).mul(100).toFixed(2)
          : null,
      };
    });

    const pageTotals = new Map<
      string,
      {
        totalBudget: Prisma.Decimal;
        actualCost: Prisma.Decimal;
        netRevenue: Prisma.Decimal;
        verifiedPayments: Prisma.Decimal;
      }
    >();

    for (const item of data) {
      if (!item.currency) continue;

      const previous = pageTotals.get(item.currency) ?? {
        totalBudget: zero,
        actualCost: zero,
        netRevenue: zero,
        verifiedPayments: zero,
      };

      pageTotals.set(item.currency, {
        totalBudget: previous.totalBudget.plus(item.totalBudget),
        actualCost: previous.actualCost.plus(item.actualCost),
        netRevenue: previous.netRevenue.plus(item.netRevenue),
        verifiedPayments: previous.verifiedPayments.plus(item.verifiedPayments),
      });
    }

    const pageSummary = [...pageTotals.entries()].map(([currency, totals]) => {
      const grossProfit = totals.netRevenue.minus(totals.actualCost);

      return {
        currency,
        totalBudget: totals.totalBudget.toFixed(2),
        actualCost: totals.actualCost.toFixed(2),
        budgetVariance: totals.totalBudget.minus(totals.actualCost).toFixed(2),
        netRevenue: totals.netRevenue.toFixed(2),
        verifiedPayments: totals.verifiedPayments.toFixed(2),
        grossProfit: grossProfit.toFixed(2),
        grossMarginPercent: totals.netRevenue.gt(0)
          ? grossProfit.div(totals.netRevenue).mul(100).toFixed(2)
          : null,
      };
    });

    return {
      data,
      pageSummary,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoiceAllocations(invoiceId: string, actorId: string) {
    const access = await this.projectAccess(actorId, "profitability.read");

    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        projectId: { not: null },
        project: access,
      },
      select: {
        id: true,
        invoiceNo: true,
        projectId: true,
        currency: true,
        status: true,
        subtotal: true,
        discountAmount: true,
        revenueAllocations: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            projectServiceId: true,
            amount: true,
            notes: true,
            projectService: {
              select: {
                masterService: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new ApiError(
        "Invoice tidak ditemukan atau tidak memiliki akses.",
        404,
      );
    }

    const netRevenue = invoice.subtotal.minus(invoice.discountAmount);

    const allocatedRevenue = invoice.revenueAllocations.reduce(
      (sum, item) => sum.plus(item.amount),
      new Prisma.Decimal(0),
    );

    return {
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        projectId: invoice.projectId,
        currency: invoice.currency,
        status: invoice.status,
      },
      summary: {
        netRevenue: netRevenue.toFixed(2),
        allocatedRevenue: allocatedRevenue.toFixed(2),
        unallocatedRevenue: netRevenue.minus(allocatedRevenue).toFixed(2),
      },
      allocations: invoice.revenueAllocations.map((item) => ({
        id: item.id,
        projectServiceId: item.projectServiceId,
        serviceName: item.projectService.masterService.name,
        amount: item.amount.toFixed(2),
        notes: item.notes,
      })),
    };
  }

  async saveInvoiceAllocations(
    invoiceId: string,
    data: SaveRevenueAllocationsDTO,
    actorId: string,
  ) {
    const access = await this.projectAccess(actorId, "profitability.update");

    return this.prisma.$transaction(
      async (tx) => {
        const invoice = await tx.invoice.findFirst({
          where: {
            id: invoiceId,
            projectId: { not: null },
            project: access,
          },
          select: {
            id: true,
            invoiceNo: true,
            projectId: true,
            currency: true,
            status: true,
            subtotal: true,
            discountAmount: true,
            updatedAt: true,
            revenueAllocations: {
              select: {
                projectServiceId: true,
                amount: true,
              },
            },
          },
        });

        if (!invoice || !invoice.projectId) {
          throw new ApiError(
            "Invoice tidak ditemukan atau tidak memiliki akses.",
            404,
          );
        }

        if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") {
          throw new ApiError(
            "Alokasi hanya dapat disimpan pada invoice yang sudah diterbitkan dan tidak dibatalkan.",
            409,
          );
        }

        const netRevenue = invoice.subtotal.minus(invoice.discountAmount);

        if (netRevenue.lt(0)) {
          throw new ApiError("Net revenue invoice tidak valid.", 409);
        }

        const normalized = data.allocations.map((item) => ({
          projectServiceId: item.projectServiceId,
          amount: this.validateAmount(item.amount),
        }));

        const uniqueIds = new Set(
          normalized.map((item) => item.projectServiceId),
        );

        if (uniqueIds.size !== normalized.length) {
          throw new ApiError(
            "Service tidak boleh muncul lebih dari sekali.",
            400,
          );
        }

        const services = await tx.projectService.findMany({
          where: {
            id: { in: [...uniqueIds] },
            projectId: invoice.projectId,
          },
          select: { id: true },
        });

        if (services.length !== uniqueIds.size) {
          throw new ApiError(
            "Terdapat Service yang tidak terdaftar pada Project invoice.",
            400,
          );
        }

        const totalAllocated = normalized.reduce(
          (sum, item) => sum.plus(item.amount),
          new Prisma.Decimal(0),
        );

        if (totalAllocated.gt(netRevenue)) {
          throw new ApiError(
            "Total alokasi tidak boleh melebihi net revenue invoice.",
            400,
          );
        }

        // Mengunci perubahan pada invoice dan mencegah penulisan
        // bersamaan berdasarkan versi updatedAt.
        const claimed = await tx.invoice.updateMany({
          where: {
            id: invoice.id,
            updatedAt: invoice.updatedAt,
            status: {
              in: ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"],
            },
          },
          data: {
            updatedAt: new Date(),
          },
        });

        if (claimed.count !== 1) {
          throw new ApiError(
            "Invoice telah berubah. Muat ulang data sebelum menyimpan alokasi.",
            409,
          );
        }

        await tx.invoiceRevenueAllocation.deleteMany({
          where: { invoiceId: invoice.id },
        });

        if (normalized.length > 0) {
          await tx.invoiceRevenueAllocation.createMany({
            data: normalized.map((item) => ({
              invoiceId: invoice.id,
              projectServiceId: item.projectServiceId,
              amount: item.amount,
            })),
          });
        }

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "UPDATE",
            entity: "InvoiceRevenueAllocation",
            entityId: invoice.id,
            details: {
              invoiceId: invoice.id,
              invoiceNo: invoice.invoiceNo,
              projectId: invoice.projectId,
              previous: invoice.revenueAllocations.map((item) => ({
                projectServiceId: item.projectServiceId,
                amount: item.amount.toString(),
              })),
              current: normalized.map((item) => ({
                projectServiceId: item.projectServiceId,
                amount: item.amount.toString(),
              })),
              totalAllocated: totalAllocated.toString(),
              netRevenue: netRevenue.toString(),
            },
          },
        });

        return {
          invoiceId: invoice.id,
          currency: invoice.currency,
          netRevenue: netRevenue.toFixed(2),
          allocatedRevenue: totalAllocated.toFixed(2),
          unallocatedRevenue: netRevenue.minus(totalAllocated).toFixed(2),
          allocations: normalized.map((item) => ({
            projectServiceId: item.projectServiceId,
            amount: item.amount.toFixed(2),
          })),
        };
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    );
  }
}
