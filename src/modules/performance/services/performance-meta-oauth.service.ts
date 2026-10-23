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

type MetaOAuthState = {
  id: string;
  connectionId: string;
  actorId: string;
  nonce: string;
  expiresAt: number;
};

type MetaTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
    code?: number;
  };
};

type MetaDebugResponse = {
  data?: {
    app_id?: string;
    is_valid?: boolean;
    expires_at?: number;
    scopes?: string[];
  };
};

const STATE_TTL = 5 * 60 * 1000;
const REQUIRED_SCOPE = "ads_read";

function nonceHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function equalNonce(a: string, b: string): boolean {
  const left = Buffer.from(nonceHash(a), "hex");
  const right = Buffer.from(nonceHash(b), "hex");
  return timingSafeEqual(left, right);
}

@injectable()
export class PerformanceMetaOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  private getConfig() {
    const appId = process.env.META_APP_ID?.trim();
    const appSecret = process.env.META_APP_SECRET?.trim();
    const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();
    const version = process.env.META_GRAPH_API_VERSION?.trim();

    if (!appId || !appSecret || !redirectUri || !version) {
      throw new ApiError("Meta OAuth belum dikonfigurasi.", 503);
    }

    if (!/^v\d+\.\d+$/.test(version)) {
      throw new ApiError("Meta Graph API version tidak valid.", 503);
    }

    let url: URL;

    try {
      url = new URL(redirectUri);
    } catch {
      throw new ApiError("Meta OAuth redirect URI tidak valid.", 503);
    }

    const local = ["localhost", "127.0.0.1"].includes(url.hostname);

    if (
      (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    ) {
      throw new ApiError(
        "Meta OAuth redirect URI harus menggunakan HTTPS.",
        503,
      );
    }

    return { appId, appSecret, redirectUri, version };
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

    if (connection.platform !== PerformancePlatform.META_ADS) {
      throw new ApiError("Connection bukan Meta Ads.", 400);
    }

    if (connection.connectedBy !== actorId) {
      throw new ApiError(
        "Hanya pemilik Connection yang dapat menghubungkan akun.",
        403,
      );
    }

    const config = this.getConfig();
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + STATE_TTL;

    const state: MetaOAuthState = {
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
        nonceHash: nonceHash(nonce),
        expiresAt: new Date(expiresAt),
      },
    });

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: REQUIRED_SCOPE,
      state: this.crypto.encrypt(JSON.stringify(state)),
    });

    return {
      url: `https://www.facebook.com/${config.version}/dialog/oauth?${params.toString()}`,
      nonce,
    };
  }

  private verifyState(encrypted: string, cookieNonce: string): MetaOAuthState {
    let state: MetaOAuthState;

    try {
      state = JSON.parse(this.crypto.decrypt(encrypted)) as MetaOAuthState;
    } catch {
      throw new ApiError("Meta OAuth state tidak valid.", 400);
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
      state.expiresAt > Date.now() + STATE_TTL ||
      state.nonce.length < 32 ||
      !cookieNonce ||
      !equalNonce(state.nonce, cookieNonce)
    ) {
      throw new ApiError("Meta OAuth state tidak cocok atau kedaluwarsa.", 403);
    }

    return state;
  }

  private async consumeState(state: MetaOAuthState): Promise<void> {
    const result = await this.prisma.performanceOAuthState.deleteMany({
      where: {
        id: state.id,
        connectionId: state.connectionId,
        actorId: state.actorId,
        nonceHash: nonceHash(state.nonce),
        expiresAt: { gt: new Date() },
      },
    });

    if (result.count !== 1) {
      throw new ApiError(
        "Meta OAuth state sudah digunakan atau kedaluwarsa.",
        403,
      );
    }
  }

  private async requestToken(url: URL): Promise<MetaTokenResponse> {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError("Meta OAuth API tidak dapat dihubungi.", 502);
    }

    const body = (await response.json().catch(() => ({}))) as MetaTokenResponse;

    if (
      !response.ok ||
      typeof body.access_token !== "string" ||
      !body.access_token
    ) {
      throw new ApiError("Gagal mendapatkan Meta access token.", 502);
    }

    return body;
  }

  private async exchangeCode(code: string) {
    const config = this.getConfig();
    const base = `https://graph.facebook.com/${config.version}/oauth/access_token`;

    const initialUrl = new URL(base);

    initialUrl.searchParams.set("client_id", config.appId);
    initialUrl.searchParams.set("client_secret", config.appSecret);
    initialUrl.searchParams.set("redirect_uri", config.redirectUri);
    initialUrl.searchParams.set("code", code);

    const initial = await this.requestToken(initialUrl);

    const extendedUrl = new URL(base);

    extendedUrl.searchParams.set("grant_type", "fb_exchange_token");
    extendedUrl.searchParams.set("client_id", config.appId);
    extendedUrl.searchParams.set("client_secret", config.appSecret);
    extendedUrl.searchParams.set("fb_exchange_token", initial.access_token!);

    const extended = await this.requestToken(extendedUrl);

    return extended.access_token!;
  }

  private async verifyToken(accessToken: string): Promise<Date> {
    const config = this.getConfig();

    const url = new URL(
      `https://graph.facebook.com/${config.version}/debug_token`,
    );

    url.searchParams.set("input_token", accessToken);
    url.searchParams.set("access_token", `${config.appId}|${config.appSecret}`);

    let response: Response;

    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      throw new ApiError("Verifikasi Meta token gagal.", 502);
    }

    if (!response.ok) {
      throw new ApiError("Meta menolak verifikasi access token.", 502);
    }

    const body = (await response.json()) as MetaDebugResponse;
    const data = body.data;

    if (
      !data?.is_valid ||
      data.app_id !== config.appId ||
      !Array.isArray(data.scopes) ||
      !data.scopes.includes(REQUIRED_SCOPE)
    ) {
      throw new ApiError(
        "Meta access token tidak valid atau permission ads_read belum diberikan.",
        403,
      );
    }

    const expiresAtSeconds = Number(data.expires_at);

    if (
      !Number.isSafeInteger(expiresAtSeconds) ||
      expiresAtSeconds <= Math.floor(Date.now() / 1000)
    ) {
      throw new ApiError(
        "Meta tidak memberikan access token dengan masa berlaku yang valid.",
        403,
      );
    }

    return new Date(expiresAtSeconds * 1000);
  }

  async handleCallback(
    code: string,
    encryptedState: string,
    cookieNonce: string,
  ) {
    if (!code || code.length > 8192 || !encryptedState || !cookieNonce) {
      throw new ApiError("Parameter Meta OAuth tidak lengkap.", 400);
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
      connection.platform !== PerformancePlatform.META_ADS ||
      connection.connectedBy !== state.actorId
    ) {
      throw new ApiError("Connection Meta OAuth tidak valid.", 403);
    }

    const accessToken = await this.exchangeCode(code);
    const tokenExpiresAt = await this.verifyToken(accessToken);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.performanceConnection.findUnique({
        where: { id: connection.id },
        select: {
          connectedBy: true,
          platform: true,
        },
      });

      if (
        !current ||
        current.connectedBy !== state.actorId ||
        current.platform !== PerformancePlatform.META_ADS
      ) {
        throw new ApiError("Connection Meta OAuth berubah.", 409);
      }

      await tx.performanceCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          accessTokenEncrypted: this.crypto.encrypt(accessToken),
          refreshTokenEncrypted: null,
          tokenExpiresAt,
        },
        update: {
          accessTokenEncrypted: this.crypto.encrypt(accessToken),
          refreshTokenEncrypted: null,
          tokenExpiresAt,
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
          entityId: updated.id,
          details: {
            platform: updated.platform,
            provider: "META",
          },
        },
      });

      return {
        connectionId: updated.id,
        platform: updated.platform,
        status: updated.status,
        tokenExpiresAt,
      };
    });
  }
}
