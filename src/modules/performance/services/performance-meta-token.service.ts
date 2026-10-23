import {
  PerformanceConnectionStatus,
  PerformancePlatform,
} from "@prisma/client";
import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";
import { PerformanceCryptoService } from "../security/performance-crypto.service";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

@injectable()
export class PerformanceMetaTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: PerformanceCryptoService,
  ) {}

  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.prisma.performanceConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        platform: true,
        status: true,
        credential: {
          select: {
            accessTokenEncrypted: true,
            tokenExpiresAt: true,
          },
        },
      },
    });

    if (!connection) {
      throw new ApiError("Connection tidak ditemukan.", 404);
    }

    if (connection.platform !== PerformancePlatform.META_ADS) {
      throw new ApiError("Connection bukan Meta Ads.", 400);
    }

    if (connection.status !== PerformanceConnectionStatus.CONNECTED) {
      throw new ApiError("Meta Ads belum terhubung.", 400);
    }

    if (!connection.credential) {
      throw new ApiError("Meta Ads credential tidak ditemukan.", 400);
    }

    const expiresAt = connection.credential.tokenExpiresAt?.getTime();

    if (!expiresAt || expiresAt <= Date.now() + EXPIRY_BUFFER_MS) {
      await this.prisma.performanceConnection.updateMany({
        where: {
          id: connectionId,
          status: PerformanceConnectionStatus.CONNECTED,
          credential: {
            is: {
              tokenExpiresAt: {
                lte: new Date(Date.now() + EXPIRY_BUFFER_MS),
              },
            },
          },
        },
        data: {
          status: PerformanceConnectionStatus.EXPIRED,
          syncEnabled: false,
          nextScheduledSyncAt: null,
        },
      });

      throw new ApiError(
        "Meta access token kedaluwarsa atau hampir kedaluwarsa. Hubungkan ulang akun.",
        401,
      );
    }

    try {
      return this.crypto.decrypt(connection.credential.accessTokenEncrypted);
    } catch {
      throw new ApiError(
        "Meta credential tidak dapat dibaca. Hubungkan ulang akun.",
        500,
      );
    }
  }
}
