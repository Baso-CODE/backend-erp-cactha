import { PerformancePlatform, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import {
  PerformanceMetricRecord,
  PerformanceProvider,
  PerformanceProviderContext,
} from "./performance-provider.interface";

type MetaAction = {
  action_type?: string;
  value?: string;
};

type MetaInsight = {
  campaign_id?: string;
  campaign_name?: string;
  date_start?: string;
  impressions?: string;
  clicks?: string;
  spend?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
};

type MetaResponse = {
  data?: MetaInsight[];
  paging?: { next?: string };
  error?: { code?: number; message?: string };
};

const CONVERSION_ACTIONS = new Set([
  "purchase",
  "lead",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "offsite_conversion.fb_pixel_lead",
]);

@injectable()
export class MetaAdsProvider implements PerformanceProvider {
  readonly platform = PerformancePlatform.META_ADS;

  async fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]> {
    const version = process.env.META_GRAPH_API_VERSION;

    if (!version || !/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("META_GRAPH_API_VERSION belum dikonfigurasi.", 503);
    }

    const accountId = context.externalAccountId.replace(/^act_/, "");

    if (!/^\d+$/.test(accountId)) {
      throw new ApiError("Meta Ad Account ID tidak valid.", 400);
    }

    const url = new URL(
      `https://graph.facebook.com/${version}/act_${accountId}/insights`,
    );

    url.searchParams.set(
      "fields",
      "campaign_id,campaign_name,date_start,impressions,clicks,spend,actions,action_values",
    );
    url.searchParams.set("level", "campaign");
    url.searchParams.set("time_increment", "1");
    url.searchParams.set("limit", "500");
    url.searchParams.set(
      "time_range",
      JSON.stringify({
        since: context.periodStart.toISOString().slice(0, 10),
        until: context.periodEnd.toISOString().slice(0, 10),
      }),
    );

    const results: PerformanceMetricRecord[] = [];
    const visited = new Set<string>();
    let next: string | undefined = url.toString();

    while (next) {
      const parsed = new URL(next);

      if (
        parsed.protocol !== "https:" ||
        parsed.hostname !== "graph.facebook.com" ||
        visited.has(next) ||
        visited.size >= 200
      ) {
        throw new ApiError("Pagination Meta Ads tidak valid.", 502);
      }

      visited.add(next);

      let response: Response;
      try {
        response = await fetch(next, {
          headers: {
            Authorization: `Bearer ${context.accessToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(30000),
        });
      } catch {
        throw new ApiError("Meta Ads API tidak dapat dihubungi.", 502);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new ApiError("Akses Meta Ads ditolak.", response.status);
        }
        if (response.status === 429) {
          throw new ApiError("Meta Ads API rate limit.", 429);
        }
        throw new ApiError(
          `Meta Ads API mengembalikan HTTP ${response.status}.`,
          502,
        );
      }

      const body = (await response.json()) as MetaResponse;

      if (!Array.isArray(body.data)) {
        throw new ApiError("Response Meta Ads tidak valid.", 502);
      }

      for (const row of body.data) {
        const campaignId = String(row.campaign_id ?? "");
        const date = String(row.date_start ?? "");

        if (!/^\d+$/.test(campaignId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new ApiError("Identitas metrik Meta Ads tidak valid.", 502);
        }

        const conversions = (row.actions ?? [])
          .filter((a) => CONVERSION_ACTIONS.has(a.action_type ?? ""))
          .reduce((sum, a) => sum.plus(a.value ?? "0"), new Prisma.Decimal(0));

        const conversionValue = (row.action_values ?? [])
          .filter((a) => CONVERSION_ACTIONS.has(a.action_type ?? ""))
          .reduce((sum, a) => sum.plus(a.value ?? "0"), new Prisma.Decimal(0));

        results.push({
          externalEntityId: campaignId,
          entityType: "CAMPAIGN",
          metricDate: new Date(`${date}T00:00:00.000Z`),
          impressions: BigInt(row.impressions ?? "0"),
          clicks: BigInt(row.clicks ?? "0"),
          conversions: conversions.toString(),
          spend: new Prisma.Decimal(row.spend ?? "0").toString(),
          conversionValue: conversionValue.toString(),
          currency: context.currency ?? null,
          metrics: {
            campaignName: row.campaign_name ?? "",
            source: "META_ADS",
          },
        });
      }

      next = body.paging?.next;
    }

    return results;
  }
}
