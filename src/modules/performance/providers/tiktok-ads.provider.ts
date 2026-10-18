import { PerformancePlatform, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import {
  PerformanceMetricRecord,
  PerformanceProvider,
  PerformanceProviderContext,
} from "./performance-provider.interface";

type TikTokRow = {
  dimensions?: {
    campaign_id?: string;
    stat_time_day?: string;
  };
  metrics?: Record<string, string | number | undefined>;
};

type TikTokReportResponse = {
  code?: number;
  message?: string;
  data?: {
    list?: TikTokRow[];
    page_info?: {
      total_page?: number;
      total_number?: number;
    };
  };
};

const PAGE_SIZE = 1000;
const MAX_PAGES = 200;

function parseMetric(
  value: string | number | undefined,
  fallback = "0",
): string {
  const result = String(value ?? fallback);
  const decimal = new Prisma.Decimal(result);

  if (!decimal.isFinite() || decimal.isNegative()) {
    throw new ApiError("Metrik TikTok Ads tidak valid.", 502);
  }

  return decimal.toString();
}

@injectable()
export class TikTokAdsProvider implements PerformanceProvider {
  readonly platform = PerformancePlatform.TIKTOK_ADS;

  async fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]> {
    if (!/^\d+$/.test(context.externalAccountId)) {
      throw new ApiError("TikTok Advertiser ID tidak valid.", 400);
    }

    const version = process.env.TIKTOK_API_VERSION ?? "v2.0";

    if (!/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("TIKTOK_API_VERSION tidak valid.", 503);
    }

    const baseUrl = `https://business-api.tiktok.com/open_api/${version}/report/integrated/get/`;

    const results: PerformanceMetricRecord[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = new URL(baseUrl);

      url.searchParams.set("advertiser_id", context.externalAccountId);
      url.searchParams.set("report_type", "BASIC");
      url.searchParams.set("data_level", "AUCTION_CAMPAIGN");
      url.searchParams.set(
        "dimensions",
        JSON.stringify(["campaign_id", "stat_time_day"]),
      );
      url.searchParams.set(
        "metrics",
        JSON.stringify([
          "campaign_name",
          "spend",
          "impressions",
          "clicks",
          "conversion",
        ]),
      );
      url.searchParams.set(
        "start_date",
        context.periodStart.toISOString().slice(0, 10),
      );
      url.searchParams.set(
        "end_date",
        context.periodEnd.toISOString().slice(0, 10),
      );
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(PAGE_SIZE));

      let response: Response;

      try {
        response = await fetch(url, {
          headers: {
            "Access-Token": context.accessToken,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        throw new ApiError("TikTok Ads API tidak dapat dihubungi.", 502);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ApiError("Akses TikTok Ads ditolak.", response.status);
        }
        if (response.status === 429) {
          throw new ApiError("TikTok Ads API rate limit.", 429);
        }
        throw new ApiError(
          `TikTok Ads API mengembalikan HTTP ${response.status}.`,
          502,
        );
      }

      const body = (await response.json()) as TikTokReportResponse;

      if (body.code !== 0 || !Array.isArray(body.data?.list)) {
        throw new ApiError(
          "TikTok Ads API menolak permintaan atau response tidak valid.",
          502,
        );
      }

      const rows = body.data.list;

      for (const row of rows) {
        const campaignId = String(row.dimensions?.campaign_id ?? "");
        const rawDate = String(row.dimensions?.stat_time_day ?? "");
        const date = rawDate.slice(0, 10);

        if (!/^\d+$/.test(campaignId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new ApiError("Identitas metrik TikTok tidak valid.", 502);
        }

        const metrics = row.metrics ?? {};

        results.push({
          externalEntityId: campaignId,
          entityType: "CAMPAIGN",
          metricDate: new Date(`${date}T00:00:00.000Z`),
          impressions: BigInt(parseMetric(metrics.impressions)),
          clicks: BigInt(parseMetric(metrics.clicks)),
          conversions: parseMetric(metrics.conversion),
          spend: parseMetric(metrics.spend),
          conversionValue: "0",
          currency: context.currency ?? null,
          metrics: {
            campaignName: String(metrics.campaign_name ?? ""),
            source: "TIKTOK_ADS",
          },
        });
      }

      const totalPages = Number(body.data.page_info?.total_page ?? 0);

      if (
        rows.length === 0 ||
        (totalPages > 0 && page >= totalPages) ||
        (totalPages === 0 && rows.length < PAGE_SIZE)
      ) {
        return results;
      }
    }

    throw new ApiError("Laporan TikTok Ads melebihi batas pagination.", 502);
  }
}
