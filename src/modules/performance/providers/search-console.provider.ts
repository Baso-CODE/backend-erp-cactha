import { PerformancePlatform } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import {
  PerformanceMetricRecord,
  PerformanceProvider,
  PerformanceProviderContext,
} from "./performance-provider.interface";

type SearchConsoleRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
};

type SearchConsoleResponse = {
  rows?: SearchConsoleRow[];
};

@injectable()
export class SearchConsoleProvider implements PerformanceProvider {
  readonly platform = PerformancePlatform.SEARCH_CONSOLE;

  async fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]> {
    const siteUrl = context.externalAccountId.trim();

    if (
      !siteUrl ||
      (!siteUrl.startsWith("sc-domain:") && !/^https?:\/\//.test(siteUrl))
    ) {
      throw new ApiError("Search Console Property tidak valid.", 400);
    }

    const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
    const results: PerformanceMetricRecord[] = [];
    const pageSize = 25000;
    let startRow = 0;

    do {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: context.periodStart.toISOString().slice(0, 10),
          endDate: context.periodEnd.toISOString().slice(0, 10),
          dimensions: ["date"],
          type: "web",
          dataState: "final",
          rowLimit: pageSize,
          startRow,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (response.status === 401)
          throw new ApiError("Search Console OAuth token tidak valid.", 401);
        if (response.status === 403)
          throw new ApiError("Akses Search Console Property ditolak.", 403);
        if (response.status === 429)
          throw new ApiError("Search Console API rate limit tercapai.", 429);
        throw new ApiError(
          `Search Console API mengembalikan HTTP ${response.status}.`,
          502,
        );
      }

      const data = (await response.json()) as SearchConsoleResponse;
      const rows = data.rows ?? [];

      if (!Array.isArray(rows)) {
        throw new ApiError("Response Search Console tidak valid.", 502);
      }

      for (const row of rows) {
        const date = row.keys?.[0] ?? "";

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new ApiError("Format tanggal Search Console tidak valid.", 502);
        }

        const metricDate = new Date(`${date}T00:00:00.000Z`);

        if (
          Number.isNaN(metricDate.getTime()) ||
          metricDate.toISOString().slice(0, 10) !== date
        ) {
          throw new ApiError("Tanggal Search Console tidak valid.", 502);
        }

        const clicks = row.clicks ?? 0;
        const impressions = row.impressions ?? 0;
        const ctr = row.ctr ?? 0;
        const position = row.position ?? 0;

        if (![clicks, impressions, ctr, position].every(Number.isFinite)) {
          throw new ApiError("Metrik Search Console tidak valid.", 502);
        }

        if (
          clicks < 0 ||
          impressions < 0 ||
          !Number.isSafeInteger(clicks) ||
          !Number.isSafeInteger(impressions)
        ) {
          throw new ApiError(
            "Jumlah klik atau impresi Search Console tidak valid.",
            502,
          );
        }

        results.push({
          externalEntityId: siteUrl,
          entityType: "SEARCH_CONSOLE_PROPERTY",
          metricDate,
          impressions: BigInt(impressions),
          clicks: BigInt(clicks),
          conversions: "0",
          spend: "0",
          conversionValue: "0",
          currency: null,
          metrics: {
            ctr,
            averagePosition: position,
            searchType: "web",
          },
        });
      }

      startRow += rows.length;
      if (rows.length < pageSize) break;
    } while (true);

    return results;
  }
}
