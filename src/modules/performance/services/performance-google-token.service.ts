import { PerformancePlatform } from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceCryptoService } from "../security/performance-crypto.service";

const GOOGLE_PLATFORMS: PerformancePlatform[] = [
  "GOOGLE_ADS",
  "GA4",
  "SEARCH_CONSOLE",
];

type GoogleRefreshResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
};

@injectable()
export class PerformanceGoogleTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      include: { credential: true },
    });

    if (!connection) throw new ApiError("Connection tidak ditemukan.", 404);
    if (!GOOGLE_PLATFORMS.includes(connection.platform)) {
      throw new ApiError("Connection bukan platform Google.", 400);
    }
    if (connection.status !== "CONNECTED") {
      throw new ApiError("Connection belum aktif.", 400);
    }

    const credential = connection.credential;
    if (!credential)
      throw new ApiError("Google credential tidak ditemukan.", 400);

    const expiresAt = credential.tokenExpiresAt?.getTime() ?? 0;
    if (expiresAt > Date.now() + 60_000) {
      return this.crypto.decrypt(credential.accessTokenEncrypted);
    }

    if (!credential.refreshTokenEncrypted) {
      throw new ApiError(
        "Refresh token tidak tersedia. Hubungkan ulang Google.",
        401,
      );
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new ApiError("Google OAuth belum dikonfigurasi.", 503);
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: this.crypto.decrypt(credential.refreshTokenEncrypted),
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = (await response
        .json()
        .catch(() => ({}))) as GoogleRefreshResponse;
      if (body.error === "invalid_grant") {
        await this.prisma.performanceConnection.update({
          where: { id: connectionId },
          data: { status: "EXPIRED", syncEnabled: false },
        });
        throw new ApiError(
          "Google authorization kedaluwarsa. Hubungkan ulang akun.",
          401,
        );
      }
      throw new ApiError("Gagal memperbarui Google access token.", 502);
    }

    const token = (await response.json()) as GoogleRefreshResponse;
    if (!token.access_token)
      throw new ApiError("Google tidak mengembalikan access token.", 502);

    await this.prisma.performanceCredential.update({
      where: { connectionId },
      data: {
        accessTokenEncrypted: this.crypto.encrypt(token.access_token),
        tokenExpiresAt: new Date(
          Date.now() + Math.max(0, token.expires_in ?? 3600) * 1000,
        ),
      },
    });

    return token.access_token;
  }
}
