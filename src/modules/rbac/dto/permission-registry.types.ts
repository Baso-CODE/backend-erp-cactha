export interface PermissionDefinition {
  code: string;
  module: string;
  action: string;
  description: string;
}

export function definePermissions(
  permissions: PermissionDefinition[],
): PermissionDefinition[] {
  return permissions;
}
