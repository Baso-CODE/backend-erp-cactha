import {
  PerformanceConnectionStatus,
  PerformancePlatform,
} from "@prisma/client";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceCryptoService } from "../security/performance-crypto.service";

type GoogleOAuthState = {
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

const GOOGLE_SCOPES: Partial<Record<PerformancePlatform, string>> = {
  GOOGLE_ADS: "https://www.googleapis.com/auth/adwords",
  GA4: "https://www.googleapis.com/auth/analytics.readonly",
  SEARCH_CONSOLE: "https://www.googleapis.com/auth/webmasters.readonly",
};

@injectable()
export class PerformanceGoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  private getConfig() {
    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ApiError("Google OAuth belum dikonfigurasi.", 503);
    }

    return { clientId, clientSecret, redirectUri };
  }

  async createAuthorization(
    connectionId: string,
    actorId: string,
  ): Promise<{ url: string; nonce: string }> {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: { id: true, platform: true, connectedBy: true },
    });

    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);
    if (connection.connectedBy !== actorId) {
      throw new ApiError(
        "Hanya pemilik Connection yang dapat menghubungkan akun.",
        403,
      );
    }

    const scope = GOOGLE_SCOPES[connection.platform];
    if (!scope)
      throw new ApiError("Platform ini tidak menggunakan Google OAuth.", 400);

    const config = this.getConfig();
    const nonce = randomBytes(32).toString("base64url");

    const state: GoogleOAuthState = {
      connectionId,
      actorId,
      nonce,
      expiresAt: Date.now() + 5 * 60 * 1000,
    };

    const encryptedState = this.crypto.encrypt(JSON.stringify(state));
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
      throw new ApiError("OAuth state tidak valid.", 400);
    }

    if (
      typeof state.connectionId !== "string" ||
      typeof state.actorId !== "string" ||
      typeof state.nonce !== "string" ||
      typeof state.expiresAt !== "number" ||
      Date.now() > state.expiresAt
    ) {
      throw new ApiError("OAuth state tidak valid atau kedaluwarsa.", 400);
    }

    const a = createHash("sha256").update(state.nonce).digest();
    const b = createHash("sha256").update(cookieNonce).digest();

    if (!timingSafeEqual(a, b)) {
      throw new ApiError("OAuth state tidak cocok dengan browser.", 403);
    }

    return state;
  }

  async handleCallback(
    code: string,
    encryptedState: string,
    cookieNonce: string,
  ) {
    const state = this.verifyState(encryptedState, cookieNonce);
    const config = this.getConfig();

    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: state.connectionId },
      select: { id: true, platform: true, connectedBy: true },
    });

    if (!connection || connection.connectedBy !== state.actorId) {
      throw new ApiError("Connection OAuth tidak valid.", 403);
    }

    const requiredScope = GOOGLE_SCOPES[connection.platform];
    if (!requiredScope) throw new ApiError("Platform OAuth tidak valid.", 400);

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(15000),
    });

    const token = (await response.json()) as GoogleTokenResponse;

    if (!response.ok || !token.access_token) {
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

    const previous = await this.prisma.performanceCredential.findUnique({
      where: { connectionId: connection.id },
      select: { refreshTokenEncrypted: true },
    });

    const refreshTokenEncrypted = token.refresh_token
      ? this.crypto.encrypt(token.refresh_token)
      : (previous?.refreshTokenEncrypted ?? null);

    if (!refreshTokenEncrypted) {
      throw new ApiError(
        "Refresh token belum diberikan oleh Google. Hubungkan ulang akun.",
        400,
      );
    }

    const expiresIn = Math.max(0, Number(token.expires_in ?? 3600));
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await this.prisma.$transaction(async (tx) => {
      await tx.performanceCredential.upsert({
        where: { connectionId: connection.id },
        create: {
          connectionId: connection.id,
          accessTokenEncrypted: this.crypto.encrypt(token.access_token!),
          refreshTokenEncrypted,
          tokenExpiresAt,
        },
        update: {
          accessTokenEncrypted: this.crypto.encrypt(token.access_token!),
          refreshTokenEncrypted,
          tokenExpiresAt,
        },
      });

      await tx.performanceConnection.update({
        where: { id: connection.id },
        data: {
          status: PerformanceConnectionStatus.CONNECTED,
          syncEnabled: false,
        },
      });
    });

    return {
      connectionId: connection.id,
      platform: connection.platform,
      status: PerformanceConnectionStatus.CONNECTED,
    };
  }
}
