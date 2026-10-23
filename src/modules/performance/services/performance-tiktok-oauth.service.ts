import {
  PerformanceConnectionStatus,
  PerformancePlatform,
} from "@prisma/client";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceCryptoService } from "../security/performance-crypto.service";

type TikTokOAuthState = {
  id: string;
  connectionId: string;
  actorId: string;
  nonce: string;
  expiresAt: number;
};

type TikTokTokenResponse = {
  code?: number;
  message?: string;
  data?: {
    access_token?: string;
    advertiser_ids?: string[];
    expires_in?: number;
    refresh_token?: string;
  };
};

const STATE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;

function hashNonce(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function compareNonce(a: string, b: string): boolean {
  const left = Buffer.from(hashNonce(a), "hex");
  const right = Buffer.from(hashNonce(b), "hex");
  return timingSafeEqual(left, right);
}

@injectable()
export class PerformanceTikTokOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  private getConfig() {
    const appId = process.env.TIKTOK_APP_ID?.trim();
    const secret = process.env.TIKTOK_APP_SECRET?.trim();
    const authorizationUrl = process.env.TIKTOK_ADVERTISER_AUTH_URL?.trim();
    const version = process.env.TIKTOK_API_VERSION?.trim() || "v2.0";

    if (!appId || !secret || !authorizationUrl) {
      throw new ApiError("TikTok OAuth belum dikonfigurasi.", 503);
    }

    if (!/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("Versi TikTok Marketing API tidak valid.", 503);
    }

    let url: URL;

    try {
      url = new URL(authorizationUrl);
    } catch {
      throw new ApiError("TikTok Authorization URL tidak valid.", 503);
    }

    if (
      url.protocol !== "https:" ||
      !["business-api.tiktok.com", "ads.tiktok.com"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.hash
    ) {
      throw new ApiError(
        "TikTok Authorization URL harus berasal dari portal resmi.",
        503,
      );
    }

    return { appId, secret, authorizationUrl, version };
  }

  async createAuthorization(
    connectionId: string,
    actorId: string,
  ): Promise<{ url: string; nonce: string }> {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        platform: true,
        connectedBy: true,
      },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.TIKTOK_ADS) {
      throw new ApiError("Connection bukan TikTok Ads.", 400);
    }

    if (connection.connectedBy !== actorId) {
      throw new ApiError(
        "Hanya pemilik Connection yang dapat menghubungkan akun.",
        403,
      );
    }

    const config = this.getConfig();
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + STATE_TTL_MS;

    const state: TikTokOAuthState = {
      id: randomUUID(),
      connectionId,
      actorId,
      nonce,
      expiresAt,
    };

    await this.prisma.performanceOAuthState.create({
      data: {
        id: state.id,
        connectionId,
        actorId,
        nonceHash: hashNonce(nonce),
        expiresAt: new Date(expiresAt),
      },
    });

    const url = new URL(config.authorizationUrl);
    url.searchParams.set("state", this.crypto.encrypt(JSON.stringify(state)));

    return { url: url.toString(), nonce };
  }

  private verifyState(
    encrypted: string,
    cookieNonce: string,
  ): TikTokOAuthState {
    let state: TikTokOAuthState;

    try {
      state = JSON.parse(this.crypto.decrypt(encrypted)) as TikTokOAuthState;
    } catch {
      throw new ApiError("TikTok OAuth state tidak valid.", 400);
    }

    if (
      !state ||
      typeof state.id !== "string" ||
      typeof state.connectionId !== "string" ||
      typeof state.actorId !== "string" ||
      typeof state.nonce !== "string" ||
      typeof state.expiresAt !== "number" ||
      !Number.isFinite(state.expiresAt) ||
      state.expiresAt <= Date.now() ||
      state.expiresAt > Date.now() + STATE_TTL_MS ||
      state.nonce.length < 32 ||
      !cookieNonce ||
      !compareNonce(state.nonce, cookieNonce)
    ) {
      throw new ApiError(
        "TikTok OAuth state tidak valid atau kedaluwarsa.",
        403,
      );
    }

    return state;
  }

  private async consumeState(state: TikTokOAuthState): Promise<void> {
    const result = await this.prisma.performanceOAuthState.deleteMany({
      where: {
        id: state.id,
        connectionId: state.connectionId,
        actorId: state.actorId,
        nonceHash: hashNonce(state.nonce),
        expiresAt: { gt: new Date() },
      },
    });

    if (result.count !== 1) {
      throw new ApiError(
        "TikTok OAuth state telah digunakan atau kedaluwarsa.",
        403,
      );
    }
  }

  private async exchangeCode(authCode: string) {
    const config = this.getConfig();

    let response: Response;

    try {
      response = await fetch(
        `https://business-api.tiktok.com/open_api/${config.version}/oauth2/access_token/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            app_id: config.appId,
            secret: config.secret,
            auth_code: authCode,
          }),
          redirect: "error",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch {
      throw new ApiError("TikTok Marketing API tidak dapat dihubungi.", 502);
    }

    const body = (await response
      .json()
      .catch(() => null)) as TikTokTokenResponse | null;

    if (
      !response.ok ||
      !body ||
      body.code !== 0 ||
      !body.data ||
      typeof body.data.access_token !== "string" ||
      !body.data.access_token
    ) {
      throw new ApiError("Gagal menukar TikTok authorization code.", 502);
    }

    const token = body.data.access_token;

    const advertiserIds = Array.isArray(body.data.advertiser_ids)
      ? body.data.advertiser_ids.filter(
          (value): value is string =>
            typeof value === "string" && /^\d+$/.test(value),
        )
      : [];

    return { token, advertiserIds };
  }

  async handleCallback(
    authCode: string,
    encryptedState: string,
    cookieNonce: string,
  ) {
    if (
      !authCode ||
      authCode.length > 8192 ||
      !encryptedState ||
      !cookieNonce
    ) {
      throw new ApiError("Parameter TikTok OAuth tidak lengkap.", 400);
    }

    const state = this.verifyState(encryptedState, cookieNonce);
    await this.consumeState(state);

    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: state.connectionId },
      select: {
        id: true,
        platform: true,
        connectedBy: true,
      },
    });

    if (
      !connection ||
      connection.platform !== PerformancePlatform.TIKTOK_ADS ||
      connection.connectedBy !== state.actorId
    ) {
      throw new ApiError("Connection TikTok OAuth tidak valid.", 403);
    }

    const result = await this.exchangeCode(authCode);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.performanceConnection.findUnique({
        where: { id: connection.id },
        select: {
          platform: true,
          connectedBy: true,
        },
      });

      if (
        !current ||
        current.platform !== PerformancePlatform.TIKTOK_ADS ||
        current.connectedBy !== state.actorId
      ) {
        throw new ApiError("Connection TikTok OAuth berubah.", 409);
      }

      await tx.performanceCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          accessTokenEncrypted: this.crypto.encrypt(result.token),
          refreshTokenEncrypted: null,
          tokenExpiresAt: null,
        },
        update: {
          accessTokenEncrypted: this.crypto.encrypt(result.token),
          refreshTokenEncrypted: null,
          tokenExpiresAt: null,
        },
      });

      const updated = await tx.performanceConnection.update({
        where: { id: connection.id },
        data: {
          status: PerformanceConnectionStatus.CONNECTED,
          syncEnabled: false,
          nextScheduledSyncAt: null,
        },
        select: {
          id: true,
          platform: true,
          status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: state.actorId,
          action: "OAUTH_CONNECTED",
          entity: "PerformanceConnection",
          entityId: connection.id,
          details: {
            platform: PerformancePlatform.TIKTOK_ADS,
            provider: "TIKTOK",
            advertiserCount: result.advertiserIds.length,
          },
        },
      });

      return {
        connectionId: updated.id,
        platform: updated.platform,
        status: updated.status,
        advertiserCount: result.advertiserIds.length,
      };
    });
  }
}
