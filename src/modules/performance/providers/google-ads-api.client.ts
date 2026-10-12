import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
export interface GoogleAdsSearchRow {
  customer?: {
    id?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    manager?: boolean;
    status?: string;
  };
  customerClient?: {
    id?: string;
    clientCustomer?: string;
    descriptiveName?: string;
    currencyCode?: string;
    timeZone?: string;
    manager?: boolean;
    status?: string;
    level?: string;
  };
  campaign?: {
    id?: string;
    name?: string;
  };
  segments?: {
    date?: string;
  };
  metrics?: Record<string, string | number | undefined>;
}

type SearchResponse = {
  results?: GoogleAdsSearchRow[];
  nextPageToken?: string;
};

@injectable()
export class GoogleAdsApiClient {
  private getConfig() {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const version = process.env.GOOGLE_ADS_API_VERSION || "v25";

    if (!developerToken) {
      throw new ApiError(
        "GOOGLE_ADS_DEVELOPER_TOKEN belum dikonfigurasi.",
        503,
      );
    }

    if (!/^v\d+$/.test(version)) {
      throw new ApiError("GOOGLE_ADS_API_VERSION tidak valid.", 500);
    }

    return { developerToken, version };
  }

  private async request<T>(
    url: string,
    accessToken: string,
    body?: object,
    loginCustomerId?: string,
  ): Promise<T> {
    const { developerToken } = this.getConfig();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      Accept: "application/json",
    };

    const loginId = loginCustomerId?.replace(/\D/g, "");
    if (loginId) headers["login-customer-id"] = loginId;
    if (body) headers["Content-Type"] = "application/json";

    let response: Response;

    try {
      response = await fetch(url, {
        method: body ? "POST" : "GET",
        headers,
        ...(body && { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError("Google Ads API tidak dapat dihubungi.", 502);
    }

    if (!response.ok) {
      const status = response.status;

      if (status === 401) {
        throw new ApiError("Google Ads access token tidak valid.", 401);
      }
      if (status === 403) {
        throw new ApiError(
          "Google Ads menolak akses. Periksa developer token, OAuth, dan akun MCC.",
          403,
        );
      }
      if (status === 429) {
        throw new ApiError("Google Ads API mencapai batas kuota.", 429);
      }
      throw new ApiError(`Google Ads API mengembalikan HTTP ${status}.`, 502);
    }

    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError("Response Google Ads API bukan JSON yang valid.", 502);
    }
  }

  async listAccessibleCustomers(accessToken: string): Promise<string[]> {
    const { version } = this.getConfig();
    const data = await this.request<{ resourceNames?: string[] }>(
      `https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`,
      accessToken,
    );

    return [
      ...new Set(
        (data.resourceNames ?? [])
          .map((name) => name.replace(/^customers\//, ""))
          .filter((id) => /^\d+$/.test(id)),
      ),
    ];
  }

  async search(
    customerId: string,
    query: string,
    accessToken: string,
    loginCustomerId?: string,
  ): Promise<GoogleAdsSearchRow[]> {
    if (!/^\d+$/.test(customerId)) {
      throw new ApiError("Google Ads Customer ID tidak valid.", 400);
    }

    const { version } = this.getConfig();
    const rows: GoogleAdsSearchRow[] = [];
    let pageToken: string | undefined;
    const seenTokens = new Set<string>();

    do {
      const response = await this.request<SearchResponse>(
        `https://googleads.googleapis.com/${version}/customers/${customerId}/googleAds:search`,
        accessToken,
        { query, ...(pageToken && { pageToken }) },
        loginCustomerId,
      );

      rows.push(...(response.results ?? []));
      const next = response.nextPageToken;

      if (!next) break;
      if (seenTokens.has(next)) {
        throw new ApiError(
          "Google Ads mengembalikan pagination token berulang.",
          502,
        );
      }

      seenTokens.add(next);
      pageToken = next;
    } while (true);

    return rows;
  }
}
