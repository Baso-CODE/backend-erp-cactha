import { PerformancePlatform, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";

import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ClientPortalAccessService } from "./client-portal-access.service";

export interface ClientPerformanceQuery {
  platform?: PerformancePlatform;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  limit: number;
}

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError("Tanggal harus menggunakan format YYYY-MM-DD.", 400);
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ApiError("Tanggal tidak valid.", 400);
  }

  return date;
}

@injectable()
export class ClientPerformanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ClientPortalAccessService,
  ) {}

  async getReport(actorId: string, query: ClientPerformanceQuery) {
    const context = await this.access.getClientContext(actorId);
    const clientId = context.clientId;

    const { platform, dateFrom, dateTo, page, limit } = query;

    const from = dateFrom ? parseDate(dateFrom) : undefined;
    const to = dateTo ? parseDate(dateTo) : undefined;

    if (from && to && from > to) {
      throw new ApiError(
        "Tanggal mulai tidak boleh melebihi tanggal akhir.",
        400,
      );
    }

    // 1. Ambil mapping milik client yang login.
    const mappings = await this.prisma.performanceMapping.findMany({
      where: {
        clientId,
        isActive: true,
        project: {
          clientId,
        },
        account: {
          status: "ACTIVE",
          ...(platform && {
            connection: { platform },
          }),
        },
      },
      select: {
        accountId: true,
        account: {
          select: {
            id: true,
            name: true,
            externalId: true,
            currency: true,
            connection: {
              select: {
                platform: true,
                status: true,
                lastSuccessfulSyncAt: true,
                dataThrough: true,
              },
            },
          },
        },
      },
    });

    // 2. Hilangkan duplikasi account yang dipetakan ke
    // beberapa project milik client yang sama.
    const uniqueAccounts = new Map(
      mappings.map((mapping) => [mapping.accountId, mapping.account]),
    );

    const candidateIds = [...uniqueAccounts.keys()];

    // 3. Cari mapping lintas-client.
    // Akun yang dipakai beberapa client tidak boleh
    // memperlihatkan metrik tingkat akun ke portal.
    const otherMappings = candidateIds.length
      ? await this.prisma.performanceMapping.findMany({
          where: {
            accountId: { in: candidateIds },
            isActive: true,
            clientId: { not: clientId },
          },
          select: {
            accountId: true,
          },
        })
      : [];

    const sharedAccountIds = new Set(
      otherMappings.map((mapping) => mapping.accountId),
    );

    const allowedAccounts = [...uniqueAccounts.values()].filter(
      (account) => !sharedAccountIds.has(account.id),
    );

    const accountIds = allowedAccounts.map((account) => account.id);

    const where: Prisma.PerformanceDailyMetricWhereInput = {
      accountId: { in: accountIds },
      ...(from || to
        ? {
            metricDate: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
    };

    const [total, metrics] = await Promise.all([
      this.prisma.performanceDailyMetric.count({ where }),

      this.prisma.performanceDailyMetric.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ metricDate: "desc" }, { id: "desc" }],
        select: {
          id: true,
          accountId: true,
          entityType: true,
          externalEntityId: true,
          metricDate: true,
          impressions: true,
          clicks: true,
          conversions: true,
          spend: true,
          conversionValue: true,
          currency: true,
          account: {
            select: {
              name: true,
              connection: {
                select: {
                  platform: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      client: {
        id: context.client.id,
        companyName: context.client.companyName,
      },

      accounts: allowedAccounts.map((account) => ({
        id: account.id,
        name: account.name,
        externalId: account.externalId,
        currency: account.currency,
        platform: account.connection.platform,
        connectionStatus: account.connection.status,
        lastSuccessfulSyncAt: account.connection.lastSuccessfulSyncAt,
        dataThrough: account.connection.dataThrough,
      })),

      excludedSharedAccounts: sharedAccountIds.size,

      data: metrics.map((metric) => ({
        id: metric.id,
        accountId: metric.accountId,
        accountName: metric.account.name,
        platform: metric.account.connection.platform,
        entityType: metric.entityType,
        externalEntityId: metric.externalEntityId,
        metricDate: metric.metricDate.toISOString().slice(0, 10),
        impressions: metric.impressions.toString(),
        clicks: metric.clicks.toString(),
        conversions: metric.conversions.toString(),
        spend: metric.spend.toString(),
        conversionValue: metric.conversionValue.toString(),
        currency: metric.currency,
      })),

      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
