import { injectable } from "tsyringe";
import { PrismaService } from "../modules/prisma/prisma.service";

@injectable()
export class UserAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async validateActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new Error("User tidak ditemukan atau sudah tidak aktif.");
    }
  }

  async validateUserHasRole(
    userId: string,
    allowedRoles: string[],
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        roles: {
          some: {
            role: {
              code: {
                in: allowedRoles,
              },
              isActive: true,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new Error(
        "User tidak valid, tidak aktif, atau tidak memiliki role yang sesuai.",
      );
    }
  }

  async validateSalesAssignee(userId: string): Promise<void> {
    return this.validateUserHasRole(userId, [
      "SALES_MANAGER",
      "SALES_EXECUTIVE",
    ]);
  }
}
