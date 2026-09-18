import { db } from "@/db";
import { auditLogs, type NewAuditLog } from "@/db/schema/audit";

export interface RecordAuditParams {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
}

export async function recordAuditLog(params: RecordAuditParams) {
  try {
    const entry: NewAuditLog = {
      tenantId: params.tenantId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      oldData: params.oldData ?? null,
      newData: params.newData ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    };

    const [inserted] = await db.insert(auditLogs).values(entry).returning();
    return inserted;
  } catch (error) {
    console.error("Failed to record audit log entry:", error);
    // Audit log should not break main flow if DB error, but log heavily
    return null;
  }
}
