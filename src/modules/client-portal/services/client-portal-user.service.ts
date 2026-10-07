import { injectable } from "tsyringe";
import { ApiError } from "../../../utils/api-error";
import { PrismaService } from "../../prisma/prisma.service";

@injectable()
export class ClientPortalUserService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptions(currentUserId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        roles: {
          some: {
            role: {
              code: "CLIENT",
              isActive: true,
            },
          },
        },
        OR: [
          {
            clientContact: null,
          },
          ...(currentUserId
            ? [
                {
                  id: currentUserId,
                },
              ]
            : []),
        ],
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    return users;
  }

  async validatePortalUser(userId: string, contactPersonId?: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        roles: {
          select: {
            role: {
              select: {
                code: true,
                isActive: true,
              },
            },
          },
        },
        clientContact: {
          select: {
            id: true,
            clientId: true,
            fullName: true,
          },
        },
      },
    });

    if (!user) {
      throw new ApiError("User Client Portal tidak ditemukan.", 404);
    }

    if (!user.isActive) {
      throw new ApiError("User Client Portal tidak aktif.", 400);
    }

    const hasClientRole = user.roles.some(
      ({ role }) => role.code === "CLIENT" && role.isActive,
    );

    if (!hasClientRole) {
      throw new ApiError("User harus memiliki role CLIENT.", 400);
    }

    if (user.clientContact && user.clientContact.id !== contactPersonId) {
      throw new ApiError(
        "User ini sudah terhubung dengan Contact Person lain.",
        409,
      );
    }

    return user;
  }
}
