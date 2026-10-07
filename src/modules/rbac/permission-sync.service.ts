import { AccessScope } from "@prisma/client";
import fs from "fs";
import path from "path";
import { injectable } from "tsyringe";

import { ApiError } from "../../utils/api-error";
import { PrismaService } from "../prisma/prisma.service";
import { PermissionDefinition } from "./dto/permission-registry.types";

interface PermissionSyncResult {
  discovered: number;
  created: number;
  updated: number;
  unchanged: number;
}

@injectable()
export class PermissionSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(): Promise<PermissionSyncResult> {
    const permissions = this.discoverPermissions();

    if (permissions.length === 0) {
      throw new ApiError("Tidak ada permission manifest yang ditemukan.", 500);
    }

    this.validatePermissions(permissions);

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
          data: permission,
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

    return {
      discovered: permissions.length,
      created,
      updated,
      unchanged,
    };
  }

  private discoverPermissions(): PermissionDefinition[] {
    const modulesPath = path.resolve(__dirname, "..");

    const manifestFiles = this.findManifestFiles(modulesPath);

    return manifestFiles.flatMap((filePath) => {
      const manifest = require(filePath) as {
        permissions?: PermissionDefinition[];
      };

      return manifest.permissions ?? [];
    });
  }

  private findManifestFiles(directory: string): string[] {
    if (!fs.existsSync(directory)) {
      return [];
    }

    const result: string[] = [];

    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        result.push(...this.findManifestFiles(fullPath));
        continue;
      }

      if (
        entry.name.endsWith(".permissions.ts") ||
        entry.name.endsWith(".permissions.js")
      ) {
        result.push(fullPath);
      }
    }

    return result;
  }

  private validatePermissions(permissions: PermissionDefinition[]): void {
    const codes = new Set<string>();

    for (const permission of permissions) {
      if (
        !permission.code ||
        !permission.module ||
        !permission.action ||
        !permission.description
      ) {
        throw new ApiError(
          "Permission manifest memiliki data yang tidak lengkap.",
          500,
        );
      }

      if (codes.has(permission.code)) {
        throw new ApiError(
          `Permission "${permission.code}" terdaftar lebih dari satu kali.`,
          500,
        );
      }

      codes.add(permission.code);
    }
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
