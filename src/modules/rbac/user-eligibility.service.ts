import { Prisma } from "@prisma/client";
import { inject, injectable } from "tsyringe";
import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { QueryUserOptionsDTO } from "./dto/query-user-options.dto";

interface UserEligibilityOptions {
  permissions: string[];
}

@injectable()
export class UserEligibilityService {
  constructor(
    @inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private buildPermissionWhere(permissions: string[]): Prisma.UserWhereInput {
    const uniquePermissions = [...new Set(permissions)];

    return {
      isActive: true,
      AND: uniquePermissions.map((permissionCode) => ({
        roles: {
          some: {
            role: {
              isActive: true,
              permissions: {
                some: {
                  permission: {
                    code: permissionCode,
                  },
                },
              },
            },
          },
        },
      })),
    };
  }

  async getEligibleUsers(query: QueryUserOptionsDTO) {
    const permissions = [...new Set(query.permissions)];

    await this.validatePermissionCodes(permissions);

    const where: Prisma.UserWhereInput = {
      ...this.buildPermissionWhere(permissions),
      ...(query.search && {
        OR: [
          {
            name: {
              contains: query.search,
            },
          },
          {
            email: {
              contains: query.search,
            },
          },
        ],
      }),
    };

    return this.prisma.user.findMany({
      where,
      take: query.limit ?? 20,
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });
  }

  async validateUserEligibility(
    userId: string,
    options: UserEligibilityOptions,
  ) {
    const permissions = [...new Set(options.permissions)];

    await this.validatePermissionCodes(permissions);

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        ...this.buildPermissionWhere(permissions),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new ApiError(
        `User tidak aktif atau tidak memiliki permission yang dibutuhkan: ${permissions.join(
          ", ",
        )}`,
        400,
      );
    }

    return user;
  }

  private async validatePermissionCodes(permissions: string[]): Promise<void> {
    if (permissions.length === 0) {
      throw new ApiError("Minimal satu permission harus diberikan", 400);
    }

    const existing = await this.prisma.permission.findMany({
      where: {
        code: {
          in: permissions,
        },
      },
      select: {
        code: true,
      },
    });

    const existingCodes = new Set(
      existing.map((permission) => permission.code),
    );

    const invalidPermissions = permissions.filter(
      (permission) => !existingCodes.has(permission),
    );

    if (invalidPermissions.length > 0) {
      throw new ApiError(
        `Permission tidak valid: ${invalidPermissions.join(", ")}`,
        400,
      );
    }
  }
}
