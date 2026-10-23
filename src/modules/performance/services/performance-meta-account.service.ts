import {
  PerformanceConnectionStatus,
  PerformancePlatform,
  Prisma,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceMetaTokenService } from "./performance-meta-token.service";

type MetaAccount = {
  id?: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

type MetaAccountResponse = {
  data?: MetaAccount[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
};

type AccountRecord = {
  externalId: string;
  name: string;
  currency: string | null;
  timezone: string | null;
  accountStatus: number | null;
};

const PAGE_LIMIT = 100;
const MAX_PAGES = 100;
const MAX_ACCOUNTS = 5000;

@injectable()
export class PerformanceMetaAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: PerformanceMetaTokenService,
  ) {}

  private getVersion(): string {
    const version = process.env.META_GRAPH_API_VERSION?.trim();

    if (!version || !/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("META_GRAPH_API_VERSION belum dikonfigurasi.", 503);
    }

    return version;
  }

  private async request(
    url: URL,
    accessToken: string,
  ): Promise<MetaAccountResponse> {
    if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") {
      throw new ApiError("URL pagination Meta tidak valid.", 502);
    }

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError("Meta Graph API tidak dapat dihubungi.", 502);
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiError("Meta access token ditolak.", 401);
      }

      if (response.status === 403) {
        throw new ApiError(
          "Akses Meta Ad Account ditolak. Periksa permission ads_read.",
          403,
        );
      }

      if (response.status === 429) {
        throw new ApiError("Meta API rate limit tercapai.", 429);
      }

      throw new ApiError(
        `Meta Graph API mengembalikan HTTP ${response.status}.`,
        502,
      );
    }

    const body = (await response
      .json()
      .catch(() => null)) as MetaAccountResponse | null;

    if (!body || !Array.isArray(body.data)) {
      throw new ApiError("Response Meta Ad Account tidak valid.", 502);
    }

    return body;
  }

  private async fetchAccounts(accessToken: string): Promise<AccountRecord[]> {
    const version = this.getVersion();
    const initialUrl = new URL(
      `https://graph.facebook.com/${version}/me/adaccounts`,
    );

    initialUrl.searchParams.set(
      "fields",
      "id,account_id,name,currency,timezone_name,account_status",
    );
    initialUrl.searchParams.set("limit", String(PAGE_LIMIT));

    const results = new Map<string, AccountRecord>();
    const visited = new Set<string>();

    let next: string | undefined = initialUrl.toString();
    let page = 0;

    while (next) {
      page++;

      if (page > MAX_PAGES) {
        throw new ApiError(
          "Meta Account Discovery melebihi batas pagination.",
          502,
        );
      }

      const currentUrl = new URL(next);

      if (visited.has(currentUrl.toString())) {
        throw new ApiError("Pagination Meta berulang.", 502);
      }

      visited.add(currentUrl.toString());

      const body = await this.request(currentUrl, accessToken);

      for (const account of body.data ?? []) {
        const rawId =
          typeof account.account_id === "string"
            ? account.account_id
            : typeof account.id === "string"
              ? account.id.replace(/^act_/, "")
              : "";

        if (!/^\d+$/.test(rawId)) {
          throw new ApiError(
            "Meta mengembalikan Ad Account ID tidak valid.",
            502,
          );
        }

        const name = account.name?.trim() || `Meta Ads ${rawId}`;
        const currency =
          account.currency && /^[A-Z]{3}$/.test(account.currency)
            ? account.currency
            : null;

        results.set(rawId, {
          externalId: rawId,
          name,
          currency,
          timezone: account.timezone_name ?? null,
          accountStatus:
            typeof account.account_status === "number"
              ? account.account_status
              : null,
        });

        if (results.size > MAX_ACCOUNTS) {
          throw new ApiError(
            "Jumlah Meta Ad Account melebihi batas discovery.",
            502,
          );
        }
      }

      next = body.paging?.next;
    }

    return [...results.values()];
  }

  async discover(connectionId: string, actorId: string) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        platform: true,
        status: true,
      },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.META_ADS) {
      throw new ApiError("Connection bukan Meta Ads.", 400);
    }

    if (connection.status !== PerformanceConnectionStatus.CONNECTED) {
      throw new ApiError("Meta Ads belum terhubung.", 400);
    }

    const accessToken = await this.tokens.getAccessToken(connectionId);
    const accounts = await this.fetchAccounts(accessToken);

    const saved: Array<{
      id: string;
      externalId: string;
      name: string;
      accountType: string;
      currency: string | null;
      timezone: string | null;
      status: string;
    }> = [];

    for (const account of accounts) {
      const metadata: Prisma.InputJsonObject = {
        source: "META_ADS",
        accountStatus: account.accountStatus ?? 0,
        discoveredAt: new Date().toISOString(),
      };

      const result = await this.prisma.performanceAccount.upsert({
        where: {
          connectionId_externalId: {
            connectionId,
            externalId: account.externalId,
          },
        },
        create: {
          connectionId,
          externalId: account.externalId,
          name: account.name,
          accountType: "META_AD_ACCOUNT",
          currency: account.currency,
          timezone: account.timezone,
          metadata,
        },
        update: {
          name: account.name,
          accountType: "META_AD_ACCOUNT",
          currency: account.currency,
          timezone: account.timezone,
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

      saved.push(result);
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "PERFORMANCE_ACCOUNT_DISCOVERED",
        entity: "PerformanceConnection",
        entityId: connectionId,
        details: {
          platform: PerformancePlatform.META_ADS,
          discovered: saved.length,
        },
      },
    });

    return {
      connectionId,
      platform: PerformancePlatform.META_ADS,
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

    if (connection.platform !== PerformancePlatform.META_ADS) {
      throw new ApiError("Connection bukan Meta Ads.", 400);
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
