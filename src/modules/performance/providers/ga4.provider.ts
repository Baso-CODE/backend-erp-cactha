import { PerformancePlatform } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import {
  PerformanceMetricRecord,
  PerformanceProvider,
  PerformanceProviderContext,
} from "./performance-provider.interface";

type GA4Row = {
  dimensionValues?: Array<{ value?: string }>;
  metricValues?: Array<{ value?: string }>;
};

type GA4ReportResponse = {
  rows?: GA4Row[];
  rowCount?: number;
};

@injectable()
export class GA4Provider implements PerformanceProvider {
  readonly platform = PerformancePlatform.GA4;

  async fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]> {
    const propertyId = context.externalAccountId.replace(/^properties\//, "");

    if (!/^\d+$/.test(propertyId)) {
      throw new ApiError("GA4 Property ID tidak valid.", 400);
    }

    const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
    const results: PerformanceMetricRecord[] = [];
    const pageSize = 10000;
    let offset = 0;

    do {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${context.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: context.periodStart.toISOString().slice(0, 10),
              endDate: context.periodEnd.toISOString().slice(0, 10),
            },
          ],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "sessions" },
            { name: "activeUsers" },
            { name: "screenPageViews" },
            { name: "eventCount" },
            { name: "keyEvents" },
          ],
          limit: String(pageSize),
          offset: String(offset),
          keepEmptyRows: true,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        if (response.status === 401)
          throw new ApiError("GA4 OAuth token tidak valid.", 401);
        if (response.status === 403)
          throw new ApiError("Akses GA4 Property ditolak.", 403);
        if (response.status === 429)
          throw new ApiError("GA4 API rate limit tercapai.", 429);
        throw new ApiError(
          `GA4 API mengembalikan HTTP ${response.status}.`,
          502,
        );
      }

      const data = (await response.json()) as GA4ReportResponse;

      if (!Array.isArray(data.rows)) {
        if ((data.rowCount ?? 0) > offset) {
          throw new ApiError(
            "Response GA4 tidak memiliki baris yang diharapkan.",
            502,
          );
        }
        break;
      }

      for (const row of data.rows) {
        const date = row.dimensionValues?.[0]?.value ?? "";
        if (!/^\d{8}$/.test(date)) {
          throw new ApiError("Format tanggal GA4 tidak valid.", 502);
        }

        const metricDate = new Date(
          `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00.000Z`,
        );

        const values = row.metricValues ?? [];
        const sessions = values[0]?.value ?? "0";
        const activeUsers = values[1]?.value ?? "0";
        const pageViews = values[2]?.value ?? "0";
        const eventCount = values[3]?.value ?? "0";
        const keyEvents = values[4]?.value ?? "0";

        if (Number.isNaN(metricDate.getTime())) {
          throw new ApiError("Tanggal GA4 tidak valid.", 502);
        }

        results.push({
          externalEntityId: propertyId,
          entityType: "GA4_PROPERTY",
          metricDate,
          impressions: BigInt(0),
          clicks: BigInt(0),
          conversions: keyEvents,
          spend: "0",
          conversionValue: "0",
          currency: null,
          metrics: {
            sessions,
            activeUsers,
            pageViews,
            eventCount,
            keyEvents,
          },
        });
      }

      offset += data.rows.length;
      if (!data.rows.length || offset >= (data.rowCount ?? offset)) break;
    } while (true);

    return results;
  }
}
