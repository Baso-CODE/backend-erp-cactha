import { PerformancePlatform } from "@prisma/client";

export interface PerformanceMetricRecord {
  externalEntityId: string;
  entityType: string;
  metricDate: Date;
  impressions: bigint;
  clicks: bigint;
  conversions: string;
  spend: string;
  conversionValue: string;
  currency: string | null;
  metrics: Record<string, string | number | boolean | null>;
}

export interface PerformanceProviderContext {
  platform: PerformancePlatform;
  externalAccountId: string;
  accessToken: string;
  refreshToken: string | null;
  loginCustomerId?: string;
  currency?: string | null;
  periodStart: Date;
  periodEnd: Date;
}

export interface PerformanceProvider {
  platform: PerformancePlatform;
  fetchMetrics(
    context: PerformanceProviderContext,
  ): Promise<PerformanceMetricRecord[]>;
}
