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
import { PerformanceMetaTokenService } from "./performance-meta-token.service";
import { PerformanceTikTokTokenService } from "./performance-tiktok-token.service";

const GOOGLE_PLATFORMS: PerformancePlatform[] = [
  "GOOGLE_ADS",
  "GA4",
  "SEARCH_CONSOLE",
];

const LEASE_MS = 15 * 60 * 1000;
const HEARTBEAT_MS = 30 * 1000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;
const MAX_METRIC_RECORDS = 100000;
const METRIC_BATCH_SIZE = 100;

class SyncLeaseLostError extends Error {
  constructor() {
    super("Kepemilikan sync job sudah hilang atau kedaluwarsa.");
    this.name = "SyncLeaseLostError";
  }
}

function parseDate(value: string): Date {
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

  const day = record.metricDate.toISOString().slice(0, 10);
  const date = parseDate(day);

  if (date < start || date > end) {
    throw new Error("Tanggal metrik di luar periode.");
  }

  if (
    typeof record.externalEntityId !== "string" ||
    !record.externalEntityId.trim() ||
    typeof record.entityType !== "string" ||
    !record.entityType.trim()
  ) {
    throw new Error("Identitas metrik tidak lengkap.");
  }

  if (
    typeof record.impressions !== "bigint" ||
    typeof record.clicks !== "bigint" ||
    record.impressions < BigInt(0) ||
    record.clicks < BigInt(0)
  ) {
    throw new Error("Nilai impressions atau clicks tidak valid.");
  }

  const maxBigInt = BigInt("9223372036854775807");
  if (record.impressions > maxBigInt || record.clicks > maxBigInt) {
    throw new Error("Nilai metrik melampaui kapasitas BigInt database.");
  }

  for (const value of [
    record.conversions,
    record.spend,
    record.conversionValue,
  ]) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error("Nilai desimal metrik tidak valid.");
    }

    const decimal = new Prisma.Decimal(value);

    if (!decimal.isFinite() || decimal.isNegative()) {
      throw new Error("Nilai desimal metrik harus finite dan tidak negatif.");
    }
  }

  if (
    record.currency !== null &&
    (typeof record.currency !== "string" || !/^[A-Z]{3}$/.test(record.currency))
  ) {
    throw new Error("Currency metrik tidak valid.");
  }

  if (
    !record.metrics ||
    typeof record.metrics !== "object" ||
    Array.isArray(record.metrics)
  ) {
    throw new Error("Metadata metrik tidak valid.");
  }

  for (const value of Object.values(record.metrics)) {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Metadata metrik mengandung angka tidak valid.");
    }
  }
}

function isTemporaryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const e = error as {
    status?: number;
    statusCode?: number;
    code?: string | number;
    message?: string;
  };

  const status = Number(e.status ?? e.statusCode ?? e.code);

  if ([408, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  const code = String(e.code ?? "").toUpperCase();

  if (
    [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
    ].includes(code)
  ) {
    return true;
  }

  const message = String(e.message ?? "");

  return /rate.limit|resource.exhausted|temporarily.unavailable|timeout|deadline.exceeded|quota.exceeded|too.many.requests/i.test(
    message,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@injectable()
export class PerformanceSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: PerformanceProviderRegistry,
    private readonly crypto: PerformanceCryptoService,
    private readonly googleTokens: PerformanceGoogleTokenService,
    private readonly metaTokens: PerformanceMetaTokenService,
    private readonly tiktokTokens: PerformanceTikTokTokenService,
  ) {}

  async getLogs(connectionId: string, page = 1, limit = 10) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
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

  private async assertLease(
    jobId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const now = new Date();

    const result = await tx.performanceSyncJob.updateMany({
      where: {
        id: jobId,
        status: PerformanceSyncStatus.RUNNING,
        lockedUntil: { gt: now },
      },
      data: {
        lockedUntil: new Date(now.getTime() + LEASE_MS),
      },
    });

    if (result.count !== 1) {
      throw new SyncLeaseLostError();
    }
  }

  private async heartbeat(jobId: string): Promise<void> {
    const now = new Date();

    const result = await this.prisma.performanceSyncJob.updateMany({
      where: {
        id: jobId,
        status: PerformanceSyncStatus.RUNNING,
        lockedUntil: { gt: now },
      },
      data: {
        lockedUntil: new Date(now.getTime() + LEASE_MS),
      },
    });

    if (result.count !== 1) {
      throw new SyncLeaseLostError();
    }
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
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtext('performance-sync'),
              hashtext(${connectionId})
            )
          `;

          const now = new Date();

          await tx.performanceSyncJob.updateMany({
            where: {
              connectionId,
              status: PerformanceSyncStatus.RUNNING,
              lockedUntil: { lte: now },
            },
            data: {
              status: PerformanceSyncStatus.FAILED,
              finishedAt: now,
              lockedUntil: null,
              errorCode: "STALE_JOB_RECOVERED",
              errorMessage: "Job ditutup karena lease kedaluwarsa.",
            },
          });

          const running = await tx.performanceSyncJob.findFirst({
            where: {
              connectionId,
              status: PerformanceSyncStatus.RUNNING,
            },
            select: { id: true },
          });

          if (running) {
            throw new ApiError("Sinkronisasi masih berjalan.", 409);
          }

          return tx.performanceSyncJob.create({
            data: {
              connectionId,
              accountId: accountId ?? null,
              mode: PerformanceSyncMode.MANUAL,
              status: PerformanceSyncStatus.RUNNING,
              periodStart: start,
              periodEnd: end,
              startedAt: now,
              lockedUntil: new Date(now.getTime() + LEASE_MS),
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2028"].includes(error.code)
      ) {
        throw new ApiError(
          "Sinkronisasi sedang diproses. Silakan coba kembali.",
          409,
        );
      }
      throw error;
    }
  }

  private async retry<T>(
    action: () => Promise<T>,
    assertActive: () => void,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      assertActive();

      try {
        return await action();
      } catch (error) {
        if (!isTemporaryError(error) || attempt >= MAX_RETRIES) {
          throw error;
        }

        const backoff =
          RETRY_BASE_MS * Math.pow(2, attempt) +
          Math.floor(Math.random() * 500);

        attempt++;
        await delay(backoff);
      }
    }
  }

  private async saveBatch(
    jobId: string,
    accountId: string,
    records: PerformanceMetricRecord[],
  ): Promise<{ inserted: number; updated: number; failed: number }> {
    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (const record of records) {
      try {
        const metricDate = parseDate(
          record.metricDate.toISOString().slice(0, 10),
        );

        const identity = {
          accountId,
          externalEntityId: record.externalEntityId,
          entityType: record.entityType,
          metricDate,
        };

        const existed = await this.prisma.$transaction(
          async (tx) => {
            await this.assertLease(jobId, tx);

            const previous = await tx.performanceDailyMetric.findUnique({
              where: {
                accountId_externalEntityId_entityType_metricDate: identity,
              },
              select: { id: true },
            });

            await tx.performanceDailyMetric.upsert({
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

            return Boolean(previous);
          },
          { timeout: 10000 },
        );

        if (existed) updated++;
        else inserted++;
      } catch (error) {
        if (error instanceof SyncLeaseLostError) throw error;

        failed++;
        console.error("[PERFORMANCE_SYNC_RECORD]", {
          jobId,
          accountId,
          message: error instanceof Error ? error.message : "Invalid record",
        });
      }
    }

    return { inserted, updated, failed };
  }

  async execute(
    connectionId: string,
    dto: ExecutePerformanceSyncDTO,
    actorId?: string,
  ) {
    const periodStart = parseDate(dto.periodStart);
    const periodEnd = parseDate(dto.periodEnd);

    if (periodStart > periodEnd) {
      throw new ApiError("Periode tidak valid.", 400);
    }

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

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.status !== PerformanceConnectionStatus.CONNECTED) {
      throw new ApiError("Connection belum terhubung.", 400);
    }

    if (!connection.credential) {
      throw new ApiError("Credential tidak tersedia.", 400);
    }

    const accounts = connection.accounts.filter(
      (account) => account.accountType !== "GOOGLE_ADS_MANAGER",
    );

    if (!accounts.length) {
      throw new ApiError("Tidak ada account yang dapat disinkronkan.", 400);
    }

    const provider = this.registry.get(connection.platform);
    const job = await this.createJob(
      connectionId,
      dto.accountId,
      periodStart,
      periodEnd,
    );

    let leaseLost = false;
    let heartbeatBusy = false;
    let fetched = 0;
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    let successfulAccounts = 0;
    const errors: string[] = [];

    const assertActive = () => {
      if (leaseLost) throw new SyncLeaseLostError();
    };

    const timer = setInterval(() => {
      if (heartbeatBusy || leaseLost) return;
      heartbeatBusy = true;

      void this.heartbeat(job.id)
        .catch((error) => {
          if (error instanceof SyncLeaseLostError) {
            leaseLost = true;
          } else {
            console.error("[PERFORMANCE_SYNC_HEARTBEAT]", {
              jobId: job.id,
              message: "Heartbeat gagal diperbarui.",
            });
          }
        })
        .finally(() => {
          heartbeatBusy = false;
        });
    }, HEARTBEAT_MS);

    try {
      const { accessToken, refreshToken } = await this.resolveCredential(
        connectionId,
        connection.platform,
        connection.credential,
      );

      for (const account of accounts) {
        assertActive();

        try {
          const metadata =
            account.metadata &&
            typeof account.metadata === "object" &&
            !Array.isArray(account.metadata)
              ? (account.metadata as Record<string, unknown>)
              : {};

          const records = await this.retry(
            () =>
              provider.fetchMetrics({
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
              }),
            assertActive,
          );

          assertActive();

          if (!Array.isArray(records) || records.length > MAX_METRIC_RECORDS) {
            throw new Error("Jumlah record provider tidak valid.");
          }

          fetched += records.length;

          const validRecords: PerformanceMetricRecord[] = [];
          const keys = new Set<string>();
          let accountFailed = false;

          for (const record of records) {
            try {
              validateRecord(record, periodStart, periodEnd);

              const key = [
                record.externalEntityId,
                record.entityType,
                record.metricDate.toISOString().slice(0, 10),
              ].join("\u0000");

              if (keys.has(key)) {
                throw new Error("Duplicate metric identity dari provider.");
              }

              keys.add(key);
              validRecords.push(record);
            } catch {
              failed++;
              accountFailed = true;
            }
          }

          for (
            let offset = 0;
            offset < validRecords.length;
            offset += METRIC_BATCH_SIZE
          ) {
            assertActive();

            const batch = validRecords.slice(
              offset,
              offset + METRIC_BATCH_SIZE,
            );

            const result = await this.saveBatch(job.id, account.id, batch);

            inserted += result.inserted;
            updated += result.updated;
            failed += result.failed;

            if (result.failed) accountFailed = true;
          }

          if (accountFailed) {
            errors.push(`Account ${account.id}: sebagian record gagal.`);
          } else {
            successfulAccounts++;
          }
        } catch (error) {
          if (error instanceof SyncLeaseLostError) throw error;

          failed++;
          errors.push(`Account ${account.id}: sinkronisasi gagal.`);

          console.error("[PERFORMANCE_SYNC_ACCOUNT]", {
            jobId: job.id,
            accountId: account.id,
            message: error instanceof Error ? error.message : "Provider error",
          });
        }
      }

      assertActive();

      const status =
        successfulAccounts === 0
          ? PerformanceSyncStatus.FAILED
          : errors.length || failed
            ? PerformanceSyncStatus.PARTIAL
            : PerformanceSyncStatus.SUCCESS;

      const finishedAt = new Date();

      await this.prisma.$transaction(async (tx) => {
        await this.assertLease(job.id, tx);

        await tx.performanceSyncJob.update({
          where: { id: job.id },
          data: {
            status,
            recordsFetched: fetched,
            recordsInserted: inserted,
            recordsUpdated: updated,
            recordsFailed: failed,
            finishedAt,
            lockedUntil: null,
            errorCode:
              status === PerformanceSyncStatus.SUCCESS
                ? null
                : "SYNC_PARTIAL_OR_FAILED",
            errorMessage: errors.length
              ? errors.join(" ").slice(0, 4000)
              : null,
          },
        });

        if (status === PerformanceSyncStatus.SUCCESS && !dto.accountId) {
          await tx.performanceConnection.update({
            where: { id: connectionId },
            data: {
              lastSuccessfulSyncAt: finishedAt,
              dataThrough: periodEnd,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: actorId ?? null,
            action: "PERFORMANCE_SYNC_COMPLETED",
            entity: "PerformanceSyncJob",
            entityId: job.id,
            details: {
              connectionId,
              platform: connection.platform,
              status,
              recordsFetched: fetched,
              recordsInserted: inserted,
              recordsUpdated: updated,
              recordsFailed: failed,
            },
          },
        });
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
      const finishedAt = new Date();

      try {
        await this.prisma.$transaction(async (tx) => {
          const result = await tx.performanceSyncJob.updateMany({
            where: {
              id: job.id,
              status: PerformanceSyncStatus.RUNNING,
              lockedUntil: { gt: finishedAt },
            },
            data: {
              status: PerformanceSyncStatus.FAILED,
              recordsFetched: fetched,
              recordsInserted: inserted,
              recordsUpdated: updated,
              recordsFailed: failed,
              finishedAt,
              lockedUntil: null,
              errorCode: "SYNC_FAILED",
              errorMessage:
                error instanceof SyncLeaseLostError
                  ? "Kepemilikan job sudah hilang."
                  : "Sinkronisasi gagal akibat kesalahan internal.",
            },
          });

          if (result.count === 1) {
            await tx.auditLog.create({
              data: {
                userId: actorId ?? null,
                action: "PERFORMANCE_SYNC_FAILED",
                entity: "PerformanceSyncJob",
                entityId: job.id,
                details: {
                  connectionId,
                  platform: connection.platform,
                  recordsFailed: failed,
                },
              },
            });
          }
        });
      } catch {
        console.error("[PERFORMANCE_SYNC_FINALIZE_FAILED]", {
          jobId: job.id,
        });
      }

      if (error instanceof SyncLeaseLostError) {
        throw new ApiError(
          "Sinkronisasi kehilangan lock. Silakan periksa riwayat sync.",
          409,
        );
      }

      throw error;
    } finally {
      clearInterval(timer);
    }
  }

  private async resolveCredential(
    connectionId: string,
    platform: PerformancePlatform,
    credential: {
      accessTokenEncrypted: string;
      refreshTokenEncrypted: string | null;
      tokenExpiresAt: Date | null;
    },
  ): Promise<{ accessToken: string; refreshToken: string | null }> {
    if (GOOGLE_PLATFORMS.includes(platform)) {
      return {
        accessToken: await this.googleTokens.getAccessToken(connectionId),
        refreshToken: null,
      };
    }

    if (platform === PerformancePlatform.META_ADS) {
      return {
        accessToken: await this.metaTokens.getAccessToken(connectionId),
        refreshToken: null,
      };
    }

    if (platform === PerformancePlatform.TIKTOK_ADS) {
      return {
        accessToken:
          await this.tiktokTokens.getValidatedAccessToken(connectionId),
        refreshToken: null,
      };
    }

    throw new ApiError("Platform Performance tidak didukung.", 400);
  }
}
