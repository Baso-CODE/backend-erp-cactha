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

type GoogleOAuthState = {
  id: string;
  connectionId: string;
  actorId: string;
  nonce: string;
  expiresAt: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

const STATE_TTL_MS = 5 * 60 * 1000;
const TOKEN_TIMEOUT_MS = 15000;
const GOOGLE_SCOPES: Partial<Record<PerformancePlatform, string>> = {
  GOOGLE_ADS: "https://www.googleapis.com/auth/adwords",
  GA4: "https://www.googleapis.com/auth/analytics.readonly",
  SEARCH_CONSOLE: "https://www.googleapis.com/auth/webmasters.readonly",
};

function hashNonce(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(hashNonce(a), "hex");
  const right = Buffer.from(hashNonce(b), "hex");
  return timingSafeEqual(left, right);
}

@injectable()
export class PerformanceGoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  private getConfig() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ApiError("Google OAuth belum dikonfigurasi.", 503);
    }

    let url: URL;
    try {
      url = new URL(redirectUri);
    } catch {
      throw new ApiError("GOOGLE_OAUTH_REDIRECT_URI tidak valid.", 503);
    }

    const isLocal =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";

    if (
      !["https:", "http:"].includes(url.protocol) ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:") ||
      (url.protocol === "http:" && !isLocal)
    ) {
      throw new ApiError(
        "Google OAuth redirect URI harus menggunakan HTTPS.",
        503,
      );
    }

    return { clientId, clientSecret, redirectUri };
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

    if (connection.connectedBy !== actorId) {
      throw new ApiError(
        "Hanya pemilik Connection yang dapat menghubungkan akun.",
        403,
      );
    }

    const scope = GOOGLE_SCOPES[connection.platform];

    if (!scope) {
      throw new ApiError("Platform ini tidak menggunakan Google OAuth.", 400);
    }

    const config = this.getConfig();
    const nonce = randomBytes(32).toString("base64url");
    const expiresAt = Date.now() + STATE_TTL_MS;

    const state: GoogleOAuthState = {
      id: randomUUID(),
      connectionId,
      actorId,
      nonce,
      expiresAt,
    };

    const encryptedState = this.crypto.encrypt(JSON.stringify(state));

    await this.prisma.performanceOAuthState.create({
      data: {
        id: state.id,
        connectionId,
        actorId,
        nonceHash: hashNonce(nonce),
        expiresAt: new Date(expiresAt),
      },
    });

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope,
      state: encryptedState,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      nonce,
    };
  }

  private verifyState(
    encryptedState: string,
    cookieNonce: string,
  ): GoogleOAuthState {
    let state: GoogleOAuthState;

    try {
      state = JSON.parse(
        this.crypto.decrypt(encryptedState),
      ) as GoogleOAuthState;
    } catch {
      throw new ApiError("Google OAuth state tidak valid.", 400);
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
      !safeEqual(state.nonce, cookieNonce)
    ) {
      throw new ApiError(
        "Google OAuth state tidak valid atau kedaluwarsa.",
        403,
      );
    }

    return state;
  }

  private async consumeState(state: GoogleOAuthState): Promise<void> {
    const result = await this.prisma.performanceOAuthState.deleteMany({
      where: {
        id: state.id,
        connectionId: state.connectionId,
        actorId: state.actorId,
        nonceHash: hashNonce(state.nonce),
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (result.count !== 1) {
      throw new ApiError(
        "Google OAuth state sudah digunakan atau kedaluwarsa.",
        403,
      );
    }
  }

  private async exchangeCode(
    code: string,
    requiredScope: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }> {
    const config = this.getConfig();

    let response: Response;

    try {
      response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
      });
    } catch {
      throw new ApiError(
        "Google OAuth tidak dapat dihubungi. Silakan coba lagi.",
        502,
      );
    }

    const token = (await response
      .json()
      .catch(() => ({}))) as GoogleTokenResponse;

    if (
      !response.ok ||
      typeof token.access_token !== "string" ||
      !token.access_token ||
      token.token_type?.toLowerCase() !== "bearer"
    ) {
      throw new ApiError(
        "Gagal memvalidasi Google OAuth authorization code.",
        502,
      );
    }

    const grantedScopes = new Set(
      (token.scope ?? "").split(/\s+/).filter(Boolean),
    );

    if (!grantedScopes.has(requiredScope)) {
      throw new ApiError(
        "Google tidak memberikan permission yang dibutuhkan.",
        403,
      );
    }

    if (typeof token.refresh_token !== "string" || !token.refresh_token) {
      throw new ApiError(
        "Google tidak memberikan refresh token. Hubungkan ulang dan berikan persetujuan akses.",
        400,
      );
    }

    const expiresIn = Number(token.expires_in);

    if (!Number.isFinite(expiresIn) || expiresIn <= 0 || expiresIn > 86400) {
      throw new ApiError(
        "Google mengembalikan masa berlaku token yang tidak valid.",
        502,
      );
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async handleCallback(
    code: string,
    encryptedState: string,
    cookieNonce: string,
  ) {
    if (!code || code.length > 8192 || !encryptedState || !cookieNonce) {
      throw new ApiError("Parameter Google OAuth tidak lengkap.", 400);
    }

    const state = this.verifyState(encryptedState, cookieNonce);

    await this.consumeState(state);

    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: state.connectionId },
      select: {
        id: true,
        platform: true,
        connectedBy: true,
        status: true,
      },
    });

    if (!connection || connection.connectedBy !== state.actorId) {
      throw new ApiError("Connection OAuth tidak valid.", 403);
    }

    const requiredScope = GOOGLE_SCOPES[connection.platform];

    if (!requiredScope) {
      throw new ApiError("Platform OAuth tidak valid.", 400);
    }

    const token = await this.exchangeCode(code, requiredScope);

    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.performanceConnection.findUnique({
        where: { id: connection.id },
        select: {
          id: true,
          platform: true,
          connectedBy: true,
        },
      });

      if (
        !current ||
        current.connectedBy !== state.actorId ||
        current.platform !== connection.platform
      ) {
        throw new ApiError("Connection OAuth telah berubah.", 409);
      }

      await tx.performanceCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          accessTokenEncrypted: this.crypto.encrypt(token.accessToken),
          refreshTokenEncrypted: this.crypto.encrypt(token.refreshToken),
          tokenExpiresAt: token.tokenExpiresAt,
        },
        update: {
          accessTokenEncrypted: this.crypto.encrypt(token.accessToken),
          refreshTokenEncrypted: this.crypto.encrypt(token.refreshToken),
          tokenExpiresAt: token.tokenExpiresAt,
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
            platform: connection.platform,
            provider: "GOOGLE",
            status: updated.status,
          },
        },
      });

      return updated;
    });

    return {
      connectionId: result.id,
      platform: result.platform,
      status: result.status,
    };
  }
}
