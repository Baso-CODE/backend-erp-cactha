import fs from "fs";
import path from "path";

import { ApiError } from "../../utils/api-error";
import { PermissionDefinition } from "./dto/permission-registry.types";

export class PermissionRegistryLoader {
  static load(): PermissionDefinition[] {
    const modulesPath = path.resolve(__dirname, "..");

    return this.loadFromDirectory(modulesPath);
  }

  static loadFromDirectory(modulesPath: string): PermissionDefinition[] {
    const manifestFiles = this.findManifestFiles(modulesPath);

    const permissions = manifestFiles.flatMap((filePath) => {
      const manifest = require(filePath) as {
        permissions?: PermissionDefinition[];
      };

      return manifest.permissions ?? [];
    });

    this.validate(permissions);

    return permissions;
  }

  static validate(permissions: PermissionDefinition[]): void {
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

  private static findManifestFiles(directory: string): string[] {
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
}
