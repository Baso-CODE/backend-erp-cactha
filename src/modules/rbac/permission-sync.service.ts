import { AccessScope } from "@prisma/client";

import { injectable } from "tsyringe";

import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionRegistryLoader } from "./permission-registry.loader";

interface PermissionSyncResult {
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
}

@injectable()
export class PermissionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(actorId: string): Promise<PermissionSyncResult> {
    const permissions = PermissionRegistryLoader.load();
    if (permissions.length === 0) {
      throw new ApiError("Tidak ada permission manifest yang ditemukan.", 500);
    }

    let created = 0;
    let updated = 0;
    let unchanged = 0;

    for (const permission of permissions) {
      const existing = await this.prisma.permission.findUnique({
        where: {
          code: permission.code,
        },
      });

      if (!existing) {
        await this.prisma.permission.create({
          data: {
            code: permission.code,
            module: permission.module,
            action: permission.action,
            description: permission.description,
          },
        });

        created++;
        continue;
      }

      const hasChanges =
        existing.module !== permission.module ||
        existing.action !== permission.action ||
        existing.description !== permission.description;

      if (!hasChanges) {
        unchanged++;
        continue;
      }

      await this.prisma.permission.update({
        where: {
          code: permission.code,
        },
        data: {
          module: permission.module,
          action: permission.action,
          description: permission.description,
        },
      });

      updated++;
    }

    await this.grantAllPermissionsToOwner();

    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "PERMISSION_SYNC",
        entity: "Permission",
        entityId: "registry",
        details: {
          discovered: permissions.length,
          created,
          updated,
          unchanged,
        },
      },
    });

    return {
      discovered: permissions.length,
      created,
      updated,
      unchanged,
    };
  }

  async getPermissions() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [
        {
          module: "asc",
        },
        {
          action: "asc",
        },
      ],
      select: {
        id: true,
        code: true,
        module: true,
        action: true,
        description: true,
      },
    });

    const grouped = permissions.reduce<Record<string, typeof permissions>>(
      (result, permission) => {
        if (!result[permission.module]) {
          result[permission.module] = [];
        }

        result[permission.module].push(permission);

        return result;
      },
      {},
    );

    return {
      permissions,
      grouped,
    };
  }

  async getRegistryStatus() {
    const discoveredPermissions = PermissionRegistryLoader.load();

    const manifestCodes = new Set(
      discoveredPermissions.map((permission) => permission.code),
    );

    const databasePermissions = await this.prisma.permission.findMany({
      orderBy: {
        code: "asc",
      },
      select: {
        id: true,
        code: true,
        module: true,
        action: true,
        description: true,
      },
    });

    const orphaned = databasePermissions.filter(
      (permission) => !manifestCodes.has(permission.code),
    );

    const registered = databasePermissions.filter((permission) =>
      manifestCodes.has(permission.code),
    );

    return {
      manifestCount: discoveredPermissions.length,
      databaseCount: databasePermissions.length,
      registeredCount: registered.length,
      orphanedCount: orphaned.length,
      orphaned,
    };
  }

  private async grantAllPermissionsToOwner(): Promise<void> {
    const ownerRole = await this.prisma.role.findUnique({
      where: {
        code: "OWNER",
      },
      select: {
        id: true,
      },
    });

    if (!ownerRole) {
      throw new ApiError('System role "OWNER" tidak ditemukan.', 500);
    }

    const permissions = await this.prisma.permission.findMany({
      select: {
        id: true,
      },
    });

    await this.prisma.$transaction(
      permissions.map((permission) =>
        this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: ownerRole.id,
              permissionId: permission.id,
            },
          },
          update: {
            scope: AccessScope.ALL,
          },
          create: {
            roleId: ownerRole.id,
            permissionId: permission.id,
            scope: AccessScope.ALL,
          },
        }),
      ),
    );
  }
}
