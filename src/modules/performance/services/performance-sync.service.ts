import {
  PerformanceConnectionStatus,
  PerformancePlatform,
  PerformanceSyncMode,
  PerformanceSyncStatus,
  Prisma,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { ExecutePerformanceSyncDTO } from "../dto/performance-sync.dto";
import { PerformanceMetricRecord } from "../providers/performance-provider.interface";
import { PerformanceProviderRegistry } from "../providers/performance-provider.registry";
import { PerformanceCryptoService } from "../security/performance-crypto.service";
import { PerformanceGoogleTokenService } from "./performance-google-token.service";

const GOOGLE_PLATFORMS: PerformancePlatform[] = [
  "GOOGLE_ADS",
  "GA4",
  "SEARCH_CONSOLE",
];

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ApiError("Tanggal harus YYYY-MM-DD.", 400);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ApiError("Tanggal tidak valid.", 400);
  }
  return date;
}

function validateRecord(
  record: PerformanceMetricRecord,
  start: Date,
  end: Date,
): void {
  if (
    !(record.metricDate instanceof Date) ||
    Number.isNaN(record.metricDate.getTime())
  ) {
    throw new Error("Tanggal metrik tidak valid.");
  }

  const date = record.metricDate.toISOString().slice(0, 10);
  if (parseDate(date) < start || parseDate(date) > end) {
    throw new Error("Tanggal metrik di luar periode.");
  }

  if (!record.externalEntityId.trim() || !record.entityType.trim()) {
    throw new Error("Identitas metrik tidak lengkap.");
  }

  if (
    record.impressions < BigInt(0) ||
    record.clicks < BigInt(0) ||
    new Prisma.Decimal(record.conversions).isNegative() ||
    new Prisma.Decimal(record.spend).isNegative() ||
    new Prisma.Decimal(record.conversionValue).isNegative()
  ) {
    throw new Error("Nilai metrik tidak valid.");
  }
}

@injectable()
export class PerformanceSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PerformanceProviderRegistry,
    private readonly crypto: PerformanceCryptoService,
    private readonly googleTokens: PerformanceGoogleTokenService,
  ) {}

  async getLogs(connectionId: string, page = 1, limit = 10) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true },
    });
    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const where = { connectionId };

    const [data, total] = await Promise.all([
      this.prisma.performanceSyncJob.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
      }),
      this.prisma.performanceSyncJob.count({ where }),
    ]);

    return {
      data,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  private async createJob(
    connectionId: string,
    accountId: string | undefined,
    start: Date,
    end: Date,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const running = await tx.performanceSyncJob.findFirst({
            where: {
              connectionId,
              status: PerformanceSyncStatus.RUNNING,
              OR: [{ lockedUntil: null }, { lockedUntil: { gt: new Date() } }],
            },
            select: { id: true },
          });

          if (running) throw new ApiError("Sinkronisasi masih berjalan.", 409);

          return tx.performanceSyncJob.create({
            data: {
              connectionId,
              accountId: accountId ?? null,
              mode: PerformanceSyncMode.MANUAL,
              status: PerformanceSyncStatus.RUNNING,
              periodStart: start,
              periodEnd: end,
              startedAt: new Date(),
              lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        throw new ApiError(
          "Sinkronisasi sedang diproses. Silakan coba kembali.",
          409,
        );
      }
      throw error;
    }
  }

  async execute(connectionId: string, dto: ExecutePerformanceSyncDTO) {
    const periodStart = parseDate(dto.periodStart);
    const periodEnd = parseDate(dto.periodEnd);

    if (periodStart > periodEnd)
      throw new ApiError("Periode tidak valid.", 400);
    if (periodEnd.getTime() - periodStart.getTime() > 90 * 86400000) {
      throw new ApiError("Periode maksimal 91 hari inklusif.", 400);
    }

    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      include: {
        credential: true,
        accounts: {
          where: {
            status: "ACTIVE",
            ...(dto.accountId && { id: dto.accountId }),
          },
        },
      },
    });

    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);
    if (connection.status !== PerformanceConnectionStatus.CONNECTED) {
      throw new ApiError("Connection belum terhubung.", 400);
    }
    if (!connection.credential)
      throw new ApiError("Credential tidak tersedia.", 400);
    if (!connection.accounts.length)
      throw new ApiError("Tidak ada account aktif.", 400);

    const provider = this.registry.get(connection.platform);
    const accessToken = GOOGLE_PLATFORMS.includes(connection.platform)
      ? await this.googleTokens.getAccessToken(connectionId)
      : this.crypto.decrypt(connection.credential.accessTokenEncrypted);

    const refreshToken = GOOGLE_PLATFORMS.includes(connection.platform)
      ? null
      : connection.credential.refreshTokenEncrypted
        ? this.crypto.decrypt(connection.credential.refreshTokenEncrypted)
        : null;

    const job = await this.createJob(
      connectionId,
      dto.accountId,
      periodStart,
      periodEnd,
    );
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let successfulAccounts = 0;
    const errors: string[] = [];

    try {
      for (const account of connection.accounts) {
        if (account.accountType === "GOOGLE_ADS_MANAGER") continue;

        try {
          const metadata =
            account.metadata &&
            typeof account.metadata === "object" &&
            !Array.isArray(account.metadata)
              ? (account.metadata as Record<string, unknown>)
              : {};

          const records = await provider.fetchMetrics({
            platform: connection.platform,
            externalAccountId: account.externalId,
            accessToken,
            refreshToken,
            loginCustomerId:
              typeof metadata.loginCustomerId === "string"
                ? metadata.loginCustomerId
                : undefined,
            currency: account.currency,
            periodStart,
            periodEnd,
          });

          fetched += records.length;
          let accountFailed = false;

          for (const record of records) {
            try {
              validateRecord(record, periodStart, periodEnd);
              const identity = {
                accountId: account.id,
                externalEntityId: record.externalEntityId,
                entityType: record.entityType,
                metricDate: parseDate(
                  record.metricDate.toISOString().slice(0, 10),
                ),
              };

              const existing =
                await this.prisma.performanceDailyMetric.findUnique({
                  where: {
                    accountId_externalEntityId_entityType_metricDate: identity,
                  },
                  select: { id: true },
                });

              await this.prisma.performanceDailyMetric.upsert({
                where: {
                  accountId_externalEntityId_entityType_metricDate: identity,
                },
                create: {
                  ...identity,
                  impressions: record.impressions,
                  clicks: record.clicks,
                  conversions: record.conversions,
                  spend: record.spend,
                  conversionValue: record.conversionValue,
                  currency: record.currency,
                  metrics: record.metrics,
                },
                update: {
                  impressions: record.impressions,
                  clicks: record.clicks,
                  conversions: record.conversions,
                  spend: record.spend,
                  conversionValue: record.conversionValue,
                  currency: record.currency,
                  metrics: record.metrics,
                },
              });

              if (existing) updated++;
              else inserted++;
            } catch (error) {
              failed++;
              accountFailed = true;
              console.error("[PERFORMANCE_SYNC_RECORD]", {
                jobId: job.id,
                accountId: account.id,
                message:
                  error instanceof Error ? error.message : "Invalid record",
              });
            }
          }

          if (!accountFailed) successfulAccounts++;
          else errors.push(`Account ${account.id}: sebagian record gagal.`);
        } catch (error) {
          failed++;
          errors.push(`Account ${account.id}: sinkronisasi gagal.`);
          console.error("[PERFORMANCE_SYNC_ACCOUNT]", {
            jobId: job.id,
            accountId: account.id,
            message: error instanceof Error ? error.message : "Provider error",
          });
        }
      }

      const processedAccounts = connection.accounts.filter(
        (account) => account.accountType !== "GOOGLE_ADS_MANAGER",
      );
      const status =
        processedAccounts.length === 0 || successfulAccounts === 0
          ? PerformanceSyncStatus.FAILED
          : errors.length || failed
            ? PerformanceSyncStatus.PARTIAL
            : PerformanceSyncStatus.SUCCESS;

      await this.prisma.$transaction(async (tx) => {
        await tx.performanceSyncJob.update({
          where: { id: job.id },
          data: {
            status,
            recordsFetched: fetched,
            recordsInserted: inserted,
            recordsUpdated: updated,
            recordsFailed: failed,
            finishedAt: new Date(),
            lockedUntil: null,
            errorMessage: errors.length
              ? errors.join(" ").slice(0, 4000)
              : null,
          },
        });

        if (status === PerformanceSyncStatus.SUCCESS) {
          await tx.performanceConnection.update({
            where: { id: connectionId },
            data: { lastSuccessfulSyncAt: new Date(), dataThrough: periodEnd },
          });
        }
      });

      return {
        jobId: job.id,
        status,
        recordsFetched: fetched,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsFailed: failed,
        failedAccounts: errors.length,
      };
    } catch (error) {
      await this.prisma.performanceSyncJob.update({
        where: { id: job.id },
        data: {
          status: PerformanceSyncStatus.FAILED,
          finishedAt: new Date(),
          lockedUntil: null,
          errorCode: "SYNC_FAILED",
          errorMessage: "Sinkronisasi gagal akibat kesalahan internal.",
        },
      });
      throw error;
    }
  }
}
