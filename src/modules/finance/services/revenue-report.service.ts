import { InvoiceStatus, PaymentStatus, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryRevenueReportDTO } from "../dto/query-revenue-report.dto";

@injectable()
export class RevenueReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private getDateRange(query: QueryRevenueReportDTO) {
    const from = query.dateFrom
      ? new Date(`${query.dateFrom}T00:00:00.000Z`)
      : undefined;

    const to = query.dateTo
      ? new Date(`${query.dateTo}T00:00:00.000Z`)
      : undefined;

    if (
      (from && Number.isNaN(from.getTime())) ||
      (to && Number.isNaN(to.getTime()))
    ) {
      throw new ApiError("Rentang tanggal tidak valid.", 400);
    }

    if (from && to && from > to) {
      throw new ApiError(
        "Tanggal mulai tidak boleh melebihi tanggal akhir.",
        400,
      );
    }

    const toExclusive = to
      ? new Date(to.getTime() + 24 * 60 * 60 * 1000)
      : undefined;

    return {
      from,
      toExclusive,
    };
  }

  private async getRevenueBreakdown(
    query: QueryRevenueReportDTO,
    actorId: string,
    dimension: "CLIENT" | "PROJECT",
  ) {
    const [invoiceScope, paymentScope] = await Promise.all([
      this.accessScopeService.getPermissionScope(actorId, "invoice.read"),
      this.accessScopeService.getPermissionScope(actorId, "payment.read"),
    ]);

    const { from, toExclusive } = this.getDateRange(query);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const zero = new Prisma.Decimal(0);

    const scopeFilters: Prisma.InvoiceWhereInput[] = [];

    if (invoiceScope !== "ALL" || paymentScope !== "ALL") {
      scopeFilters.push({ client: { accountManagerId: actorId } });
    }

    const baseInvoiceWhere: Prisma.InvoiceWhereInput = {
      AND: [
        {
          status: {
            in: [
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
          ...(query.clientId && { clientId: query.clientId }),
          ...(query.projectId && { projectId: query.projectId }),
          ...(query.currency && { currency: query.currency }),
        },
        ...scopeFilters,
      ],
    };

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      AND: [
        baseInvoiceWhere,
        ...(from || toExclusive
          ? [
              {
                invoiceDate: {
                  ...(from && { gte: from }),
                  ...(toExclusive && { lt: toExclusive }),
                },
              },
            ]
          : []),
      ],
    };

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.VERIFIED,
      invoice: baseInvoiceWhere,
      ...(from || toExclusive
        ? {
            paymentDate: {
              ...(from && { gte: from }),
              ...(toExclusive && { lt: toExclusive }),
            },
          }
        : {}),
    };

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          clientId: true,
          projectId: true,
          currency: true,
          subtotal: true,
          discountAmount: true,
          client: {
            select: {
              id: true,
              clientCode: true,
              companyName: true,
            },
          },
          project: {
            select: {
              id: true,
              projectCode: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amountPaid: true,
          invoice: {
            select: {
              clientId: true,
              projectId: true,
              currency: true,
              client: {
                select: {
                  id: true,
                  clientCode: true,
                  companyName: true,
                },
              },
              project: {
                select: {
                  id: true,
                  projectCode: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    type BreakdownItem = {
      id: string | null;
      code: string | null;
      name: string;
      currency: string;
      netRevenue: Prisma.Decimal;
      cashCollected: Prisma.Decimal;
      invoiceCount: number;
      paymentCount: number;
    };

    const groups = new Map<string, BreakdownItem>();

    const getGroup = (
      client: {
        id: string;
        clientCode: string;
        companyName: string;
      },
      project: {
        id: string;
        projectCode: string;
        name: string;
      } | null,
      currency: string,
    ) => {
      const entity =
        dimension === "CLIENT"
          ? {
              id: client.id,
              code: client.clientCode,
              name: client.companyName,
            }
          : {
              id: project?.id ?? null,
              code: project?.projectCode ?? null,
              name: project?.name ?? "Tanpa Project",
            };

      const key = JSON.stringify([currency, entity.id]);
      const existing = groups.get(key);

      if (existing) return existing;

      const created: BreakdownItem = {
        ...entity,
        currency,
        netRevenue: new Prisma.Decimal(0),
        cashCollected: new Prisma.Decimal(0),
        invoiceCount: 0,
        paymentCount: 0,
      };

      groups.set(key, created);
      return created;
    };

    for (const invoice of invoices) {
      if (
        invoice.subtotal.lt(0) ||
        invoice.discountAmount.lt(0) ||
        invoice.discountAmount.gt(invoice.subtotal)
      ) {
        throw new ApiError(
          `Net Revenue Invoice ${invoice.id} tidak valid.`,
          409,
        );
      }

      const group = getGroup(invoice.client, invoice.project, invoice.currency);

      group.netRevenue = group.netRevenue.plus(
        invoice.subtotal.minus(invoice.discountAmount),
      );
      group.invoiceCount++;
    }

    for (const payment of payments) {
      if (payment.amountPaid.lt(0)) {
        throw new ApiError("Terdapat Payment tidak valid.", 409);
      }

      const invoice = payment.invoice;
      const group = getGroup(invoice.client, invoice.project, invoice.currency);

      group.cashCollected = group.cashCollected.plus(payment.amountPaid);
      group.paymentCount++;
    }

    const rows = [...groups.values()].sort((a, b) => {
      const currencyOrder = a.currency.localeCompare(b.currency);
      if (currencyOrder !== 0) return currencyOrder;

      const revenueOrder = b.netRevenue.comparedTo(a.netRevenue);
      if (revenueOrder !== 0) return revenueOrder;

      return (a.id ?? "").localeCompare(b.id ?? "");
    });

    const totals = new Map<
      string,
      {
        netRevenue: Prisma.Decimal;
        cashCollected: Prisma.Decimal;
        invoiceCount: number;
        paymentCount: number;
      }
    >();

    for (const row of rows) {
      const current = totals.get(row.currency) ?? {
        netRevenue: zero,
        cashCollected: zero,
        invoiceCount: 0,
        paymentCount: 0,
      };

      totals.set(row.currency, {
        netRevenue: current.netRevenue.plus(row.netRevenue),
        cashCollected: current.cashCollected.plus(row.cashCollected),
        invoiceCount: current.invoiceCount + row.invoiceCount,
        paymentCount: current.paymentCount + row.paymentCount,
      });
    }

    const total = rows.length;
    const paginatedRows = rows.slice((page - 1) * limit, page * limit);

    return {
      dimension,
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        clientId: query.clientId ?? null,
        projectId: query.projectId ?? null,
        currency: query.currency ?? null,
      },
      data: paginatedRows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        currency: row.currency,
        netRevenue: row.netRevenue.toFixed(2),
        cashCollected: row.cashCollected.toFixed(2),
        invoiceCount: row.invoiceCount,
        paymentCount: row.paymentCount,
      })),
      totalsByCurrency: [...totals.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, value]) => ({
          currency,
          netRevenue: value.netRevenue.toFixed(2),
          cashCollected: value.cashCollected.toFixed(2),
          invoiceCount: value.invoiceCount,
          paymentCount: value.paymentCount,
        })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRevenueByClients(query: QueryRevenueReportDTO, actorId: string) {
    return this.getRevenueBreakdown(query, actorId, "CLIENT");
  }

  async getRevenueByProjects(query: QueryRevenueReportDTO, actorId: string) {
    return this.getRevenueBreakdown(query, actorId, "PROJECT");
  }

  async getSummary(query: QueryRevenueReportDTO, actorId: string) {
    const invoiceScope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );

    const paymentScope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.read",
    );

    const { from, toExclusive } = this.getDateRange(query);

    const filters: Prisma.InvoiceWhereInput = {
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.OVERDUE,
        ],
      },
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.projectId && { projectId: query.projectId }),
      ...(query.currency && { currency: query.currency }),
    };

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      AND: [
        filters,
        ...(invoiceScope === "ALL"
          ? []
          : [{ client: { accountManagerId: actorId } }]),
        ...(from || toExclusive
          ? [
              {
                invoiceDate: {
                  ...(from && { gte: from }),
                  ...(toExclusive && { lt: toExclusive }),
                },
              },
            ]
          : []),
      ],
    };

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.VERIFIED,
      invoice: {
        AND: [
          filters,
          ...(invoiceScope === "ALL"
            ? []
            : [{ client: { accountManagerId: actorId } }]),
          ...(paymentScope === "ALL"
            ? []
            : [{ client: { accountManagerId: actorId } }]),
        ],
      },
      ...(from || toExclusive
        ? {
            paymentDate: {
              ...(from && { gte: from }),
              ...(toExclusive && { lt: toExclusive }),
            },
          }
        : {}),
    };

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          id: true,
          currency: true,
          subtotal: true,
          discountAmount: true,
          totalAmount: true,
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          amountPaid: true,
          invoice: {
            select: { currency: true },
          },
        },
      }),
    ]);

    const zero = new Prisma.Decimal(0);

    type CurrencySummary = {
      netRevenue: Prisma.Decimal;
      invoicedAmount: Prisma.Decimal;
      cashCollected: Prisma.Decimal;
      invoiceCount: number;
      paymentCount: number;
    };

    const groups = new Map<string, CurrencySummary>();

    const getGroup = (currency: string) => {
      const current = groups.get(currency);

      if (current) return current;

      const created: CurrencySummary = {
        netRevenue: new Prisma.Decimal(0),
        invoicedAmount: new Prisma.Decimal(0),
        cashCollected: new Prisma.Decimal(0),
        invoiceCount: 0,
        paymentCount: 0,
      };

      groups.set(currency, created);
      return created;
    };

    for (const invoice of invoices) {
      const netRevenue = invoice.subtotal.minus(invoice.discountAmount);

      if (netRevenue.lt(zero)) {
        throw new ApiError(
          "Terdapat Invoice dengan Net Revenue tidak valid.",
          409,
        );
      }

      const group = getGroup(invoice.currency);
      group.netRevenue = group.netRevenue.plus(netRevenue);
      group.invoicedAmount = group.invoicedAmount.plus(invoice.totalAmount);
      group.invoiceCount++;
    }

    for (const payment of payments) {
      const group = getGroup(payment.invoice.currency);
      group.cashCollected = group.cashCollected.plus(payment.amountPaid);
      group.paymentCount++;
    }

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        clientId: query.clientId ?? null,
        projectId: query.projectId ?? null,
        currency: query.currency ?? null,
      },
      summaryByCurrency: [...groups.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, group]) => ({
          currency,
          netRevenue: group.netRevenue.toFixed(2),
          invoicedAmount: group.invoicedAmount.toFixed(2),
          cashCollected: group.cashCollected.toFixed(2),
          invoiceCount: group.invoiceCount,
          paymentCount: group.paymentCount,
        })),
    };
  }

  async getTrend(query: QueryRevenueReportDTO, actorId: string) {
    const invoiceScope = await this.accessScopeService.getPermissionScope(
      actorId,
      "invoice.read",
    );
    const paymentScope = await this.accessScopeService.getPermissionScope(
      actorId,
      "payment.read",
    );

    if (Boolean(query.dateFrom) !== Boolean(query.dateTo)) {
      throw new ApiError(
        "Filter trend harus menyertakan dateFrom dan dateTo sekaligus.",
        400,
      );
    }

    const now = new Date();
    const defaultFrom = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
    );
    const defaultToExclusive = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const range = this.getDateRange(query);
    const from = range.from ?? defaultFrom;
    const toExclusive = range.toExclusive ?? defaultToExclusive;

    const firstMonth = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
    );
    const lastIncludedDay = new Date(toExclusive.getTime() - 1);
    const lastMonth = new Date(
      Date.UTC(
        lastIncludedDay.getUTCFullYear(),
        lastIncludedDay.getUTCMonth(),
        1,
      ),
    );

    const monthCount =
      (lastMonth.getUTCFullYear() - firstMonth.getUTCFullYear()) * 12 +
      lastMonth.getUTCMonth() -
      firstMonth.getUTCMonth() +
      1;

    if (monthCount < 1 || monthCount > 24) {
      throw new ApiError("Rentang Revenue Trend maksimal 24 bulan.", 400);
    }

    const invoiceFilters: Prisma.InvoiceWhereInput = {
      status: {
        in: [
          InvoiceStatus.SENT,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.OVERDUE,
        ],
      },
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.projectId && { projectId: query.projectId }),
      ...(query.currency && { currency: query.currency }),
    };

    const invoiceAccess: Prisma.InvoiceWhereInput =
      invoiceScope === "ALL" ? {} : { client: { accountManagerId: actorId } };

    const paymentAccess: Prisma.InvoiceWhereInput =
      paymentScope === "ALL" ? {} : { client: { accountManagerId: actorId } };

    const invoiceWhere: Prisma.InvoiceWhereInput = {
      AND: [
        invoiceFilters,
        invoiceAccess,
        {
          invoiceDate: {
            gte: from,
            lt: toExclusive,
          },
        },
      ],
    };

    const paymentWhere: Prisma.PaymentWhereInput = {
      status: PaymentStatus.VERIFIED,
      paymentDate: {
        gte: from,
        lt: toExclusive,
      },
      invoice: {
        AND: [invoiceFilters, paymentAccess, invoiceAccess],
      },
    };

    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: invoiceWhere,
        select: {
          invoiceDate: true,
          currency: true,
          subtotal: true,
          discountAmount: true,
        },
      }),
      this.prisma.payment.findMany({
        where: paymentWhere,
        select: {
          paymentDate: true,
          amountPaid: true,
          invoice: {
            select: {
              currency: true,
            },
          },
        },
      }),
    ]);

    type MonthlyValue = {
      netRevenue: Prisma.Decimal;
      cashCollected: Prisma.Decimal;
      invoiceCount: number;
      paymentCount: number;
    };

    const zero = new Prisma.Decimal(0);
    const groups = new Map<string, Map<string, MonthlyValue>>();

    const monthKey = (date: Date) =>
      `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
        2,
        "0",
      )}`;

    const months = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(
        Date.UTC(
          firstMonth.getUTCFullYear(),
          firstMonth.getUTCMonth() + index,
          1,
        ),
      );
      return monthKey(date);
    });

    const getMonthlyValue = (currency: string, month: string) => {
      let currencyGroup = groups.get(currency);

      if (!currencyGroup) {
        currencyGroup = new Map<string, MonthlyValue>();
        groups.set(currency, currencyGroup);
      }

      let value = currencyGroup.get(month);

      if (!value) {
        value = {
          netRevenue: new Prisma.Decimal(0),
          cashCollected: new Prisma.Decimal(0),
          invoiceCount: 0,
          paymentCount: 0,
        };
        currencyGroup.set(month, value);
      }

      return value;
    };

    for (const invoice of invoices) {
      if (
        invoice.subtotal.lt(0) ||
        invoice.discountAmount.lt(0) ||
        invoice.discountAmount.gt(invoice.subtotal)
      ) {
        throw new ApiError(
          "Terdapat Invoice dengan Net Revenue tidak valid.",
          409,
        );
      }

      const value = getMonthlyValue(
        invoice.currency,
        monthKey(invoice.invoiceDate),
      );

      value.netRevenue = value.netRevenue.plus(
        invoice.subtotal.minus(invoice.discountAmount),
      );
      value.invoiceCount++;
    }

    for (const payment of payments) {
      const value = getMonthlyValue(
        payment.invoice.currency,
        monthKey(payment.paymentDate),
      );

      value.cashCollected = value.cashCollected.plus(payment.amountPaid);
      value.paymentCount++;
    }

    if (query.currency && !groups.has(query.currency)) {
      groups.set(query.currency, new Map());
    }

    const seriesByCurrency = [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, values]) => {
        let totalNetRevenue = zero;
        let totalCashCollected = zero;
        let totalInvoices = 0;
        let totalPayments = 0;

        const points = months.map((month) => {
          const value = values.get(month) ?? {
            netRevenue: zero,
            cashCollected: zero,
            invoiceCount: 0,
            paymentCount: 0,
          };

          totalNetRevenue = totalNetRevenue.plus(value.netRevenue);
          totalCashCollected = totalCashCollected.plus(value.cashCollected);
          totalInvoices += value.invoiceCount;
          totalPayments += value.paymentCount;

          return {
            month,
            netRevenue: value.netRevenue.toFixed(2),
            cashCollected: value.cashCollected.toFixed(2),
            invoiceCount: value.invoiceCount,
            paymentCount: value.paymentCount,
          };
        });

        return {
          currency,
          totals: {
            netRevenue: totalNetRevenue.toFixed(2),
            cashCollected: totalCashCollected.toFixed(2),
            invoiceCount: totalInvoices,
            paymentCount: totalPayments,
          },
          points,
        };
      });

    return {
      filters: {
        dateFrom: from.toISOString().slice(0, 10),
        dateTo: lastIncludedDay.toISOString().slice(0, 10),
        clientId: query.clientId ?? null,
        projectId: query.projectId ?? null,
        currency: query.currency ?? null,
      },
      granularity: "MONTH",
      timezone: "UTC",
      months,
      seriesByCurrency,
    };
  }
}
