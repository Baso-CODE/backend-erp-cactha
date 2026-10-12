import { AccessScope, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { AccessScopeService } from "../../../helpers/access-scope.service";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { QueryPerformanceDataDTO } from "../dto/performance-data.dto";

function parseDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ApiError("Tanggal harus YYYY-MM-DD.", 400);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new ApiError("Tanggal tidak valid.", 400);
  return date;
}

@injectable()
export class PerformanceDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopes: AccessScopeService,
  ) {}

  async getAll(query: QueryPerformanceDataDTO, actorId: string) {
    const scope = await this.scopes.getPermissionScope(
      actorId,
      "performance.data.read",
    );
    const allowedScopes: AccessScope[] = [
      AccessScope.ALL,
      AccessScope.OWN,
      AccessScope.TEAM,
      AccessScope.PROJECT,
    ];

    if (!allowedScopes.includes(scope)) {
      throw new ApiError("Scope Performance Data belum didukung.", 403);
    }
    const from = query.dateFrom ? parseDay(query.dateFrom) : undefined;
    const to = query.dateTo ? parseDay(query.dateTo) : undefined;
    if (from && to && from > to)
      throw new ApiError("dateFrom tidak boleh setelah dateTo.", 400);
    const actorTeamIds =
      scope === AccessScope.TEAM
        ? [
            ...new Set([
              actorId,
              ...(await this.scopes.getTeamMemberIds(actorId)),
            ]),
          ]
        : [];
    const ownership: Prisma.PerformanceMappingWhereInput =
      scope === AccessScope.ALL
        ? {}
        : scope === AccessScope.OWN
          ? {
              OR: [
                { project: { projectManagerId: actorId } },
                { client: { accountManagerId: actorId } },
              ],
            }
          : scope === AccessScope.TEAM
            ? {
                OR: [
                  { project: { projectManagerId: { in: actorTeamIds } } },
                  { client: { accountManagerId: { in: actorTeamIds } } },
                ],
              }
            : { project: { projectManagerId: actorId } };
    const where: Prisma.PerformanceDailyMetricWhereInput = {
      ...(query.accountId && { accountId: query.accountId }),
      ...(from || to
        ? { metricDate: { ...(from && { gte: from }), ...(to && { lte: to }) } }
        : {}),
      account: {
        ...(query.platform && { connection: { platform: query.platform } }),
        mappings: {
          some: {
            isActive: true,
            ...(query.clientId && { clientId: query.clientId }),
            ...(query.projectId && { projectId: query.projectId }),
            ...ownership,
          },
        },
      },
    };
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
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
              connection: { select: { platform: true } },
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
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
