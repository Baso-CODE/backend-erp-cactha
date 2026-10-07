import { AccessScope } from "@prisma/client";

export interface PermissionDefinition {
  code: string;
  module: string;
  action: string;
  description: string;
  allowedScopes?: AccessScope[];
}

export function definePermissions(
  permissions: PermissionDefinition[],
): PermissionDefinition[] {
  return permissions;
}
