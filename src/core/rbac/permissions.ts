export const PERMISSIONS = [
  "ledger:read",
  "ledger:write",
  "ledger:void",
  "projects:read",
  "projects:write",
  "projects:read_sensitive",
  "assets:read",
  "assets:write",
  "tenancy:admin",
] as const;

export type PermissionCode = (typeof PERMISSIONS)[number];

export const SYSTEM_ROLES = [
  "OWNER",
  "ADMIN",
  "PROJECT_MANAGER",
  "MAINTENANCE_OPERATOR",
  "FINANCIAL_AUDITOR",
  "MEMBER",
] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];

export const ROLE_PERMISSIONS: Record<SystemRole, readonly PermissionCode[]> = {
  OWNER: [
    "ledger:read",
    "ledger:write",
    "ledger:void",
    "projects:read",
    "projects:write",
    "projects:read_sensitive",
    "assets:read",
    "assets:write",
    "tenancy:admin",
  ],
  ADMIN: [
    "ledger:read",
    "ledger:write",
    "ledger:void",
    "projects:read",
    "projects:write",
    "projects:read_sensitive",
    "assets:read",
    "assets:write",
  ],
  PROJECT_MANAGER: [
    "ledger:read",
    "projects:read",
    "projects:write",
  ],
  MAINTENANCE_OPERATOR: [
    "assets:read",
    "assets:write",
  ],
  FINANCIAL_AUDITOR: [
    "ledger:read",
  ],
  MEMBER: [
    "projects:read",
    "assets:read",
  ],
};

export function hasPermission(role: string, permission: PermissionCode): boolean {
  const roleKey = role as SystemRole;
  const permissions = ROLE_PERMISSIONS[roleKey];
  if (!permissions) {
    return false;
  }
  return permissions.includes(permission);
}
