import {
  PerformanceConnectionStatus,
  PerformancePlatform,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceCryptoService } from "../security/performance-crypto.service";

type TikTokAdvertiser = {
  advertiser_id?: string | number;
};

type TikTokAdvertiserResponse = {
  code?: number;
  message?: string;
  data?: {
    list?: TikTokAdvertiser[];
  };
};

@injectable()
export class PerformanceTikTokTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  private getConfig() {
    const appId = process.env.TIKTOK_APP_ID?.trim();
    const secret = process.env.TIKTOK_APP_SECRET?.trim();
    const version = process.env.TIKTOK_API_VERSION?.trim() || "v2.0";

    if (!appId || !secret) {
      throw new ApiError("TikTok API belum dikonfigurasi.", 503);
    }

    if (!/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("TIKTOK_API_VERSION tidak valid.", 503);
    }

    return { appId, secret, version };
  }

  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        platform: true,
        status: true,
        credential: {
          select: { accessTokenEncrypted: true },
        },
      },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.TIKTOK_ADS) {
      throw new ApiError("Connection bukan TikTok Ads.", 400);
    }

    if (connection.status !== PerformanceConnectionStatus.CONNECTED) {
      throw new ApiError("TikTok Ads belum terhubung.", 400);
    }

    if (!connection.credential) {
      throw new ApiError("TikTok credential tidak ditemukan.", 400);
    }

    try {
      return this.crypto.decrypt(connection.credential.accessTokenEncrypted);
    } catch {
      throw new ApiError("TikTok credential tidak dapat dibaca.", 500);
    }
  }

  private async markExpired(connectionId: string): Promise<void> {
    await this.prisma.performanceConnection.updateMany({
      where: {
        id: connectionId,
        status: PerformanceConnectionStatus.CONNECTED,
      },
      data: {
        status: PerformanceConnectionStatus.EXPIRED,
        syncEnabled: false,
        nextScheduledSyncAt: null,
      },
    });
  }

  async getAuthorizedAdvertisers(connectionId: string): Promise<string[]> {
    const accessToken = await this.getAccessToken(connectionId);
    const { appId, secret, version } = this.getConfig();

    const url = new URL(
      `https://business-api.tiktok.com/open_api/${version}/oauth2/advertiser/get/`,
    );

    url.searchParams.set("app_id", appId);
    url.searchParams.set("secret", secret);

    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: {
          "Access-Token": accessToken,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new ApiError("TikTok Advertiser API tidak dapat dihubungi.", 502);
    }

    if (response.status === 401) {
      await this.markExpired(connectionId);
      throw new ApiError(
        "TikTok authorization tidak berlaku. Hubungkan ulang akun.",
        401,
      );
    }

    if (response.status === 403) {
      throw new ApiError(
        "TikTok menolak akses. Periksa permission aplikasi.",
        403,
      );
    }

    if (response.status === 429) {
      throw new ApiError("TikTok API rate limit tercapai.", 429);
    }

    if (!response.ok) {
      throw new ApiError(
        `TikTok API mengembalikan HTTP ${response.status}.`,
        502,
      );
    }

    const body = (await response
      .json()
      .catch(() => null)) as TikTokAdvertiserResponse | null;

    if (!body || body.code !== 0 || !Array.isArray(body.data?.list)) {
      throw new ApiError(
        "TikTok Advertiser API mengembalikan response tidak valid atau gagal.",
        502,
      );
    }

    const ids = new Set<string>();

    for (const item of body.data.list) {
      const id = String(item?.advertiser_id ?? "");

      if (!/^\d+$/.test(id)) {
        throw new ApiError(
          "TikTok mengembalikan Advertiser ID tidak valid.",
          502,
        );
      }

      ids.add(id);
    }

    return [...ids];
  }

  async getValidatedAccessToken(connectionId: string): Promise<string> {
    await this.getAuthorizedAdvertisers(connectionId);
    return this.getAccessToken(connectionId);
  }
}
