// src/common/services/access-scope.service.ts

import { AccessScope } from "@prisma/client";
import { injectable } from "tsyringe";
import { PrismaService } from "../modules/prisma/prisma.service";

@injectable()
export class AccessScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async getPermissionScope(
    userId: string,
    permissionCode: string,
  ): Promise<AccessScope> {
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
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
      include: {
        role: {
          include: {
            permissions: {
              where: {
                permission: {
                  code: permissionCode,
                },
              },
            },
          },
        },
      },
    });

    const scopes = userRoles.flatMap((userRole) =>
      userRole.role.permissions.map((item) => item.scope),
    );

    if (scopes.includes(AccessScope.ALL)) return AccessScope.ALL;
    if (scopes.includes(AccessScope.TEAM)) return AccessScope.TEAM;
    if (scopes.includes(AccessScope.PROJECT)) return AccessScope.PROJECT;
    if (scopes.includes(AccessScope.CLIENT)) return AccessScope.CLIENT;

    return AccessScope.OWN;
  }
}
