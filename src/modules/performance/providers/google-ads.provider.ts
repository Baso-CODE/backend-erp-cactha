import { PerformancePlatform, Prisma } from "@prisma/client";
import { injectable } from "tsyringe";
import { GoogleAdsApiClient } from "./google-ads-api.client";
import {
  PerformanceMetricRecord,
  PerformanceProvider,
  PerformanceProviderContext,
} from "./performance-provider.interface";

@injectable()
export class GoogleAdsProvider implements PerformanceProvider {
  readonly platform = PerformancePlatform.GOOGLE_ADS;

  constructor(private readonly api: GoogleAdsApiClient) {}

  async fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]> {
    const from = context.periodStart.toISOString().slice(0, 10);
    const to = context.periodEnd.toISOString().slice(0, 10);

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
    `;

    const rows = await this.api.search(
      context.externalAccountId,
      query,
      context.accessToken,
      context.loginCustomerId,
    );

    return rows.map((row) => {
      const metrics = row.metrics ?? {};
      const costMicros = new Prisma.Decimal(String(metrics.costMicros ?? "0"));

      return {
        externalEntityId: String(row.campaign?.id ?? ""),
        entityType: "CAMPAIGN",
        metricDate: new Date(`${row.segments?.date}T00:00:00.000Z`),
        impressions: BigInt(String(metrics.impressions ?? "0")),
        clicks: BigInt(String(metrics.clicks ?? "0")),
        conversions: String(metrics.conversions ?? "0"),
        spend: costMicros.div(1000000).toFixed(6),
        conversionValue: String(metrics.conversionsValue ?? "0"),
        currency: context.currency ?? null,
        metrics: {
          campaignName: row.campaign?.name ?? "",
        },
      };
    });
  }
}
