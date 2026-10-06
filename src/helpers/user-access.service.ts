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
}
