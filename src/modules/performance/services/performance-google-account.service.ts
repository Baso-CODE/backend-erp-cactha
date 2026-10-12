import { Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { GoogleAdsApiClient } from "../providers/google-ads-api.client";
import { PerformanceGoogleTokenService } from "./performance-google-token.service";

type AccountRecord = {
  externalId: string;
  name: string;
  accountType: string;
  currency: string | null;
  timezone: string | null;
  metadata: Prisma.InputJsonObject;
};

@injectable()
export class PerformanceGoogleAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: PerformanceGoogleTokenService,
    private readonly ads: GoogleAdsApiClient,
  ) {}

  private async request<T>(url: string, token: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError("Google API tidak dapat dihubungi.", 502);
    }

    if (!response.ok) {
      if (response.status === 401)
        throw new ApiError("Google OAuth token ditolak.", 401);
      if (response.status === 403)
        throw new ApiError("Google API menolak permission akun.", 403);
      if (response.status === 429)
        throw new ApiError("Google API rate limit tercapai.", 429);
      throw new ApiError(
        `Google API mengembalikan HTTP ${response.status}.`,
        502,
      );
    }

    return response.json() as Promise<T>;
  }

  private async discoverAds(token: string): Promise<AccountRecord[]> {
    const roots = await this.ads.listAccessibleCustomers(token);
    const found = new Map<string, AccountRecord>();

    for (const rootId of roots) {
      const ownRows = await this.ads.search(
        rootId,
        "SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager, customer.status FROM customer",
        token,
      );

      for (const row of ownRows) {
        const customer = row.customer;
        const id = customer?.id ?? rootId;

        found.set(id, {
          externalId: id,
          name: customer?.descriptiveName || `Google Ads ${id}`,
          accountType: customer?.manager
            ? "GOOGLE_ADS_MANAGER"
            : "GOOGLE_ADS_CUSTOMER",
          currency: customer?.currencyCode ?? null,
          timezone: customer?.timeZone ?? null,
          metadata: {
            isManager: customer?.manager ?? false,
            status: customer?.status ?? "UNKNOWN",
            loginCustomerId: rootId,
            directAccess: true,
          },
        });

        if (!customer?.manager) continue;

        const children = await this.ads.search(
          rootId,
          "SELECT customer_client.id, customer_client.client_customer, customer_client.descriptive_name, customer_client.currency_code, customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.level FROM customer_client",
          token,
          rootId,
        );

        for (const item of children) {
          const child = item.customerClient;
          const childId =
            child?.id ?? child?.clientCustomer?.replace(/^customers\//, "");
          if (!childId || !/^\d+$/.test(childId)) continue;

          if (
            found.has(childId) &&
            found.get(childId)?.metadata.directAccess === true
          ) {
            continue;
          }

          found.set(childId, {
            externalId: childId,
            name: child?.descriptiveName || `Google Ads ${childId}`,
            accountType: child?.manager
              ? "GOOGLE_ADS_MANAGER"
              : "GOOGLE_ADS_CUSTOMER",
            currency: child?.currencyCode ?? null,
            timezone: child?.timeZone ?? null,
            metadata: {
              isManager: child?.manager ?? false,
              status: child?.status ?? "UNKNOWN",
              loginCustomerId: rootId,
              directAccess: childId === rootId,
              level: Number(child?.level ?? 0),
            },
          });
        }
      }
    }

    return [...found.values()];
  }

  private async discoverGA4(token: string): Promise<AccountRecord[]> {
    const accounts: AccountRecord[] = [];
    let pageToken: string | undefined;
    const seen = new Set<string>();

    do {
      const url = new URL(
        "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
      );
      url.searchParams.set("pageSize", "200");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const result = await this.request<{
        accountSummaries?: Array<{
          account?: string;
          propertySummaries?: Array<{ property: string; displayName?: string }>;
        }>;
        nextPageToken?: string;
      }>(url.toString(), token);

      for (const summary of result.accountSummaries ?? []) {
        for (const property of summary.propertySummaries ?? []) {
          accounts.push({
            externalId: property.property,
            name: property.displayName || property.property,
            accountType: "GA4_PROPERTY",
            currency: null,
            timezone: null,
            metadata: { googleAccount: summary.account ?? "" },
          });
        }
      }

      const next = result.nextPageToken;
      if (!next) break;
      if (seen.has(next)) throw new ApiError("Pagination GA4 berulang.", 502);
      seen.add(next);
      pageToken = next;
    } while (true);

    return accounts;
  }

  private async discoverSearchConsole(token: string): Promise<AccountRecord[]> {
    const result = await this.request<{
      siteEntry?: Array<{ siteUrl: string; permissionLevel?: string }>;
    }>("https://www.googleapis.com/webmasters/v3/sites", token);

    return (result.siteEntry ?? []).map((site) => ({
      externalId: site.siteUrl,
      name: site.siteUrl,
      accountType: "SEARCH_CONSOLE_PROPERTY",
      currency: null,
      timezone: null,
      metadata: { permissionLevel: site.permissionLevel ?? "" },
    }));
  }

  async discover(connectionId: string) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, platform: true },
    });

    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);

    if (
      !["GOOGLE_ADS", "GA4", "SEARCH_CONSOLE"].includes(connection.platform)
    ) {
      throw new ApiError(
        "Platform ini tidak menggunakan Google Account Discovery.",
        400,
      );
    }

    const token = await this.tokens.getAccessToken(connectionId);
    const accounts =
      connection.platform === "GOOGLE_ADS"
        ? await this.discoverAds(token)
        : connection.platform === "GA4"
          ? await this.discoverGA4(token)
          : await this.discoverSearchConsole(token);

    const saved = await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const account of accounts) {
        const result = await tx.performanceAccount.upsert({
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
            accountType: account.accountType,
            currency: account.currency,
            timezone: account.timezone,
            metadata: account.metadata,
          },
          update: {
            name: account.name,
            accountType: account.accountType,
            currency: account.currency,
            timezone: account.timezone,
            metadata: account.metadata,
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

        results.push(result);
      }

      return results;
    });

    return {
      connectionId,
      platform: connection.platform,
      discovered: saved.length,
      accounts: saved,
    };
  }

  async getAccounts(connectionId: string) {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true },
    });

    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);

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
      orderBy: { name: "asc" },
    });
  }
}
