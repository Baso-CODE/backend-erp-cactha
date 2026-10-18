import { AccessScope, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryPerformanceDataDTO } from "../dto/performance-data.dto";

function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError("Tanggal harus YYYY-MM-DD.", 400);
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
export class PerformanceDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
  ) {}

  private async getOwnership(
    scope: AccessScope,
    actorId: string,
  ): Promise<Prisma.PerformanceMappingWhereInput> {
    switch (scope) {
      case AccessScope.ALL:
        return {};
      case AccessScope.OWN:
        return {
          OR: [
            { project: { projectManagerId: actorId } },
            { client: { accountManagerId: actorId } },
          ],
        };
      case AccessScope.TEAM: {
        const members = [
          ...new Set([
            actorId,
            ...(await this.scopes.getTeamMemberIds(actorId)),
          ]),
        ];
        return {
          OR: [
            { project: { projectManagerId: { in: members } } },
            { client: { accountManagerId: { in: members } } },
          ],
        };
      }
      case AccessScope.PROJECT:
        return { project: { projectManagerId: actorId } };
      default:
        throw new ApiError("Scope Performance Data tidak didukung.", 403);
    }
  }

  async getAll(query: QueryPerformanceDataDTO, actorId: string) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "performance.data.read",
    );

    const ownership = await this.getOwnership(scope, actorId);
    const from = query.dateFrom ? parseDay(query.dateFrom) : undefined;
    const to = query.dateTo ? parseDay(query.dateTo) : undefined;

    if (from && to && from > to) {
      throw new ApiError("dateFrom tidak boleh setelah dateTo.", 400);
    }

    const mappingFilter: Prisma.PerformanceMappingWhereInput = {
      isActive: true,
      ...(query.clientId && { clientId: query.clientId }),
      ...(query.projectId && { projectId: query.projectId }),
      ...ownership,
    };

    const where: Prisma.PerformanceDailyMetricWhereInput = {
      ...(query.accountId && { accountId: query.accountId }),
      ...(from || to
        ? {
            metricDate: {
              ...(from && { gte: from }),
              ...(to && { lte: to }),
            },
          }
        : {}),
      account: {
        ...(query.platform && {
          connection: { platform: query.platform },
        }),
        mappings: { some: mappingFilter },
      },
    };

    if (scope !== AccessScope.ALL) {
      const accessibleMappings = await this.prisma.performanceMapping.findMany({
        where: mappingFilter,
        select: { accountId: true, clientId: true },
      });

      const accountIds = [
        ...new Set(accessibleMappings.map((item) => item.accountId)),
      ];

      const allMappings = accountIds.length
        ? await this.prisma.performanceMapping.findMany({
            where: {
              accountId: { in: accountIds },
              isActive: true,
            },
            select: { accountId: true, clientId: true },
          })
        : [];

      const clientsByAccount = new Map<string, Set<string>>();

      for (const mapping of allMappings) {
        let clients = clientsByAccount.get(mapping.accountId);
        if (!clients) {
          clients = new Set<string>();
          clientsByAccount.set(mapping.accountId, clients);
        }
        clients.add(mapping.clientId);
      }

      const validAccountIds = accountIds.filter(
        (id) => clientsByAccount.get(id)?.size === 1,
      );

      where.AND = [{ accountId: { in: validAccountIds } }];
    }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));

    const [total, rows] = await Promise.all([
      this.prisma.performanceDailyMetric.count({ where }),
      this.prisma.performanceDailyMetric.findMany({
        where,
        orderBy: [{ metricDate: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          entityType: true,
          externalEntityId: true,
          metricDate: true,
          impressions: true,
          clicks: true,
          conversions: true,
          spend: true,
          conversionValue: true,
          currency: true,
          metrics: true,
          account: {
            select: {
              id: true,
              name: true,
              externalId: true,
              connection: {
                select: { platform: true },
              },
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        ...row,
        impressions: row.impressions.toString(),
        clicks: row.clicks.toString(),
        conversions: row.conversions.toString(),
        spend: row.spend.toString(),
        conversionValue: row.conversionValue.toString(),
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
