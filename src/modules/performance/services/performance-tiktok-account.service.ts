import { PerformancePlatform, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceTikTokTokenService } from "./performance-tiktok-token.service";

@injectable()
export class PerformanceTikTokAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: PerformanceTikTokTokenService,
  ) {}

  async discover(connectionId: string, actorId: string) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, platform: true },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.TIKTOK_ADS) {
      throw new ApiError("Connection bukan TikTok Ads.", 400);
    }

    const advertiserIds =
      await this.tokens.getAuthorizedAdvertisers(connectionId);

    const saved = await this.prisma.$transaction(
      async (tx) => {
        const results = [];

        for (const advertiserId of advertiserIds) {
          const existing = await tx.performanceAccount.findUnique({
            where: {
              connectionId_externalId: {
                connectionId,
                externalId: advertiserId,
              },
            },
            select: {
              name: true,
              currency: true,
              timezone: true,
            },
          });

          const metadata: Prisma.InputJsonObject = {
            source: "TIKTOK_ADS",
            discoveredAt: new Date().toISOString(),
            authorizationVerified: true,
          };

          const account = await tx.performanceAccount.upsert({
            where: {
              connectionId_externalId: {
                connectionId,
                externalId: advertiserId,
              },
            },
            create: {
              connectionId,
              externalId: advertiserId,
              name: `TikTok Ads ${advertiserId}`,
              accountType: "TIKTOK_ADVERTISER",
              currency: null,
              timezone: null,
              metadata,
            },
            update: {
              name: existing?.name || `TikTok Ads ${advertiserId}`,
              accountType: "TIKTOK_ADVERTISER",
              currency: existing?.currency ?? null,
              timezone: existing?.timezone ?? null,
              metadata,
            },
            select: {
              id: true,
              externalId: true,
              name: true,
              accountType: true,
              currency: true,
              timezone: true,
              status: true,
            },
          });

          results.push(account);
        }

        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: "PERFORMANCE_ACCOUNT_DISCOVERED",
            entity: "PerformanceConnection",
            entityId: connectionId,
            details: {
              platform: PerformancePlatform.TIKTOK_ADS,
              discovered: results.length,
            },
          },
        });

        return results;
      },
      {
        timeout: 20000,
        maxWait: 10000,
      },
    );

    return {
      connectionId,
      platform: PerformancePlatform.TIKTOK_ADS,
      discovered: saved.length,
      accounts: saved,
    };
  }

  async getAccounts(connectionId: string) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, platform: true },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.TIKTOK_ADS) {
      throw new ApiError("Connection bukan TikTok Ads.", 400);
    }

    return this.prisma.performanceAccount.findMany({
      where: { connectionId },
      select: {
        id: true,
        externalId: true,
        name: true,
        accountType: true,
        currency: true,
        timezone: true,
        status: true,
        metadata: true,
        createdAt: true,
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }
}
