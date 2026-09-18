import { hasPermission, type PermissionCode } from "./permissions";

export class UnauthorizedError extends Error {
  public statusCode = 401;
  constructor(message = "Unauthorized: Authentication required") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  public statusCode = 403;
  constructor(message = "Forbidden: Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  public statusCode = 404;
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export interface UserContext {
  user: {
    id: string;
    email: string;
    fullName?: string;
  };
  membership: {
    tenantId: string;
    role: string;
  };
}

export async function requireAuth(
  contextResolver?: () => Promise<UserContext>
): Promise<UserContext> {
  if (!contextResolver) {
    throw new UnauthorizedError();
  }
  const ctx = await contextResolver();
  if (!ctx || !ctx.user) {
    throw new UnauthorizedError();
  }
  return ctx;
}

export async function requirePermission(
  permission: PermissionCode,
  contextResolver?: () => Promise<UserContext>
): Promise<UserContext> {
  const ctx = await requireAuth(contextResolver);

  const allowed = hasPermission(ctx.membership.role, permission);
  if (!allowed) {
    throw new ForbiddenError(
      `Forbidden: Role '${ctx.membership.role}' lacks permission '${permission}'`
    );
  }

  return ctx;
}
