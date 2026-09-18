"use client";

import React from "react";
import { hasPermission, type PermissionCode } from "@/core/rbac/permissions";

export interface PermissionGateProps {
  userRole?: string | null;
  requiredPermission: PermissionCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  userRole,
  requiredPermission,
  children,
  fallback = null,
}: PermissionGateProps) {
  if (!userRole) {
    return <>{fallback}</>;
  }

  const allowed = hasPermission(userRole, requiredPermission);
  if (!allowed) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
