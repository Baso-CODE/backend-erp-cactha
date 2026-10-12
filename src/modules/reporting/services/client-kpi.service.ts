import {
  AccessScope,
  ClientStatus,
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryClientKpiDTO } from "../dto/query-client-kpi.dto";

type Period = {
  from?: Date;
  toExclusive?: Date;
};

@injectable()
export class ClientKpiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessScopeService: AccessScopeService,
  ) {}

  private getPeriod(query: QueryClientKpiDTO): Period {
    const from = query.dateFrom
      ? new Date(`${query.dateFrom.slice(0, 10)}T00:00:00.000Z`)
      : undefined;

    const toExclusive = query.dateTo
      ? new Date(
          Date.parse(`${query.dateTo.slice(0, 10)}T00:00:00.000Z`) + 86400000,
        )
      : undefined;

    if (from && toExclusive && from >= toExclusive) {
      throw new ApiError("dateFrom tidak boleh setelah dateTo.", 400);
    }

    return { from, toExclusive };
  }

  private dateWhere(period: Period) {
    if (!period.from && !period.toExclusive) return undefined;

    return {
      ...(period.from && { gte: period.from }),
      ...(period.toExclusive && { lt: period.toExclusive }),
    };
  }

  private async getClientScopeWhere(
    actorId: string,
  ): Promise<Prisma.ClientWhereInput> {
    const scope = await this.accessScopeService.getPermissionScope(
      actorId,
      "client.read",
    );

    switch (scope) {
      case AccessScope.ALL:
        return {};

      case AccessScope.OWN:
        return { accountManagerId: actorId };

      case AccessScope.TEAM: {
        const memberIds =
          await this.accessScopeService.getTeamMemberIds(actorId);

        return { accountManagerId: { in: memberIds } };
      }

      default:
        throw new ApiError(
          `Scope ${scope} tidak didukung untuk Client KPI.`,
          403,
        );
    }
  }

  private async getClientWhere(
    query: QueryClientKpiDTO,
    actorId: string,
  ): Promise<Prisma.ClientWhereInput> {
    const scopeWhere = await this.getClientScopeWhere(actorId);

    return {
      AND: [
        scopeWhere,
        ...(query.clientId ? [{ id: query.clientId }] : []),
        ...(query.accountManagerId
          ? [{ accountManagerId: query.accountManagerId }]
          : []),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.search
          ? [
              {
                OR: [
                  { companyName: { contains: query.search.trim() } },
                  { clientCode: { contains: query.search.trim() } },
                  { industry: { contains: query.search.trim() } },
                ],
              },
            ]
          : []),
      ],
    };
  }

  private async getFinancialScopeWhere(
    actorId: string,
  ): Promise<Prisma.ClientWhereInput> {
    const [invoiceScope, paymentScope] = await Promise.all([
      this.accessScopeService.getPermissionScope(actorId, "invoice.read"),
      this.accessScopeService.getPermissionScope(actorId, "payment.read"),
    ]);

    const conditions: Prisma.ClientWhereInput[] = [];

    if (invoiceScope !== AccessScope.ALL) {
      conditions.push({ accountManagerId: actorId });
    }

    if (paymentScope !== AccessScope.ALL) {
      conditions.push({ accountManagerId: actorId });
    }

    return conditions.length ? { AND: conditions } : {};
  }

  private async countRepeatClients(
    where: Prisma.ClientWhereInput,
    period: Period,
  ) {
    const projectDate = this.dateWhere(period);

    const grouped = await this.prisma.project.groupBy({
      by: ["clientId"],
      where: {
        client: { is: where },
        ...(projectDate && { createdAt: projectDate }),
      },
      _count: { _all: true },
      having: { id: { _count: { gte: 2 } } },
    });

    return grouped.length;
  }

  async getOverview(query: QueryClientKpiDTO, actorId: string) {
    const where = await this.getClientWhere(query, actorId);
    const period = this.getPeriod(query);
    const projectDate = this.dateWhere(period);

    const [
      totalClients,
      activeClients,
      inactiveClients,
      projects,
      repeatClients,
      clientsWithProjects,
    ] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.count({
        where: { AND: [where, { status: ClientStatus.ACTIVE }] },
      }),
      this.prisma.client.count({
        where: { AND: [where, { status: ClientStatus.INACTIVE }] },
      }),
      this.prisma.project.count({
        where: {
          client: { is: where },
          ...(projectDate && { createdAt: projectDate }),
        },
      }),
      this.countRepeatClients(where, period),
      this.prisma.project.groupBy({
        by: ["clientId"],
        where: {
          client: { is: where },
          ...(projectDate && { createdAt: projectDate }),
        },
        _count: { _all: true },
      }),
    ]);

    return {
      filters: {
        search: query.search ?? null,
        clientId: query.clientId ?? null,
        accountManagerId: query.accountManagerId ?? null,
        status: query.status ?? null,
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
      },
      summary: {
        totalClients,
        activeClients,
        inactiveClients,
        totalProjects: projects,
        clientsWithProjects: clientsWithProjects.length,
        repeatClients,
        repeatClientRate:
          clientsWithProjects.length > 0
            ? Math.round((repeatClients / clientsWithProjects.length) * 100)
            : null,
        averageProjectsPerClient:
          totalClients > 0
            ? Math.round((projects / totalClients) * 100) / 100
            : null,
      },
      definitions: {
        dateBasis: "Project.createdAt",
        repeatClient: "Client dengan minimal 2 Project dalam periode.",
        retention: "Tidak dihitung tanpa histori lifecycle Client.",
      },
    };
  }

  async getRanking(query: QueryClientKpiDTO, actorId: string) {
    const where = await this.getClientWhere(query, actorId);
    const period = this.getPeriod(query);
    const projectDate = this.dateWhere(period);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const grouped = await this.prisma.project.groupBy({
      by: ["clientId"],
      where: {
        client: { is: where },
        ...(projectDate && { createdAt: projectDate }),
      },
      _count: { _all: true },
    });

    const counts = new Map(
      grouped.map((item) => [item.clientId, item._count._all]),
    );

    const clients = await this.prisma.client.findMany({
      where,
      select: {
        id: true,
        clientCode: true,
        companyName: true,
        status: true,
        industry: true,
        accountManager: {
          select: { id: true, name: true },
        },
      },
    });

    const ranking = clients
      .map((client) => ({
        client,
        totalProjects: counts.get(client.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.totalProjects - a.totalProjects ||
          a.client.companyName.localeCompare(b.client.companyName) ||
          a.client.id.localeCompare(b.client.id),
      );

    const total = ranking.length;

    return {
      data: ranking
        .slice((page - 1) * limit, page * limit)
        .map((item, index) => ({
          rank: (page - 1) * limit + index + 1,
          ...item,
          isRepeatClient: item.totalProjects >= 2,
        })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      sort: "PROJECTS_DESC",
      dateBasis: "Project.createdAt",
    };
  }

  async getFinancial(query: QueryClientKpiDTO, actorId: string) {
    const [clientWhere, financeWhere] = await Promise.all([
      this.getClientWhere(query, actorId),
      this.getFinancialScopeWhere(actorId),
    ]);
    const where: Prisma.ClientWhereInput = {
      AND: [clientWhere, financeWhere],
    };
    const period = this.getPeriod(query);
    const dateFilter = this.dateWhere(period);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const [totalClients, clients] = await Promise.all([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy: [{ companyName: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          clientCode: true,
          companyName: true,
        },
      }),
    ]);

    const clientIds = clients.map((client) => client.id);

    const [invoiced, payments, outstandingInvoices] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ["clientId", "currency"],
        where: {
          clientId: { in: clientIds },
          status: {
            notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
          },
          ...(dateFilter && { invoiceDate: dateFilter }),
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where: {
          status: PaymentStatus.VERIFIED,
          invoice: {
            clientId: { in: clientIds },
            status: { not: InvoiceStatus.CANCELLED },
          },
          ...(dateFilter && { paymentDate: dateFilter }),
        },
        select: {
          amountPaid: true,
          invoice: {
            select: { clientId: true, currency: true },
          },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          clientId: { in: clientIds },
          status: {
            notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED],
          },
        },
        select: {
          clientId: true,
          currency: true,
          totalAmount: true,
          payments: {
            where: { status: PaymentStatus.VERIFIED },
            select: { amountPaid: true },
          },
        },
      }),
    ]);

    type Money = {
      currency: string;
      invoiced: Prisma.Decimal;
      collected: Prisma.Decimal;
      outstanding: Prisma.Decimal;
      invoiceCount: number;
    };

    const buckets = new Map<string, Money>();
    const zero = () => new Prisma.Decimal(0);
    const keyOf = (clientId: string, currency: string) =>
      `${clientId}:${currency}`;

    const getBucket = (clientId: string, currency: string) => {
      const key = keyOf(clientId, currency);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          currency,
          invoiced: zero(),
          collected: zero(),
          outstanding: zero(),
          invoiceCount: 0,
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const item of invoiced) {
      const bucket = getBucket(item.clientId, item.currency);
      bucket.invoiced = bucket.invoiced.plus(item._sum.totalAmount ?? zero());
      bucket.invoiceCount += item._count._all;
    }

    for (const payment of payments) {
      const bucket = getBucket(
        payment.invoice.clientId,
        payment.invoice.currency,
      );
      bucket.collected = bucket.collected.plus(payment.amountPaid);
    }

    for (const invoice of outstandingInvoices) {
      const paid = invoice.payments.reduce(
        (sum, payment) => sum.plus(payment.amountPaid),
        zero(),
      );
      const outstanding = Prisma.Decimal.max(
        invoice.totalAmount.minus(paid),
        zero(),
      );
      const bucket = getBucket(invoice.clientId, invoice.currency);
      bucket.outstanding = bucket.outstanding.plus(outstanding);
    }

    const data = clients.map((client) => ({
      client,
      currencies: [...buckets.entries()]
        .filter(([key]) => key.startsWith(`${client.id}:`))
        .map(([, item]) => ({
          currency: item.currency,
          invoiceCount: item.invoiceCount,
          invoiced: item.invoiced.toFixed(2),
          collected: item.collected.toFixed(2),
          outstanding: item.outstanding.toFixed(2),
        }))
        .sort((a, b) => a.currency.localeCompare(b.currency)),
    }));

    const summary = new Map<
      string,
      {
        invoiced: Prisma.Decimal;
        collected: Prisma.Decimal;
        outstanding: Prisma.Decimal;
      }
    >();

    for (const item of buckets.values()) {
      const current = summary.get(item.currency) ?? {
        invoiced: zero(),
        collected: zero(),
        outstanding: zero(),
      };
      current.invoiced = current.invoiced.plus(item.invoiced);
      current.collected = current.collected.plus(item.collected);
      current.outstanding = current.outstanding.plus(item.outstanding);
      summary.set(item.currency, current);
    }

    return {
      data,
      pageSummary: [...summary].map(([currency, amount]) => ({
        currency,
        invoiced: amount.invoiced.toFixed(2),
        collected: amount.collected.toFixed(2),
        outstanding: amount.outstanding.toFixed(2),
      })),
      meta: {
        page,
        limit,
        total: totalClients,
        totalPages: Math.ceil(totalClients / limit),
      },
      definitions: {
        invoiced: "Invoice non-draft/non-cancelled berdasarkan invoiceDate.",
        collected: "Verified Payment berdasarkan paymentDate.",
        outstanding: "Saldo outstanding saat ini, tanpa filter periode.",
        summaryScope: "Hanya halaman aktif, dipisah per currency.",
      },
    };
  }
}
