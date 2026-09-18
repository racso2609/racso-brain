import { db } from "@/db";
import {
  assetUsageLogs,
  insertAssetUsageLogSchema,
  type AssetUsageLog,
} from "@/db/schema/assets";
import type { AssetUsageMetricType } from "@/core/assets/types";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";
import type { PaginatedResult } from "@/lib/pagination/types";
import { recordAuditLog } from "@/core/audit/service";

export class InvalidTelemetryValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTelemetryValueError";
  }
}

export interface RecordUsageLogInput {
  tenantId: string;
  assetId: string;
  metricType: AssetUsageMetricType;
  value: string | number;
  notes?: string | null;
  allowMeterReplacement?: boolean;
  recordedBy?: string | null;
  recordedAt?: Date;
}

export async function recordUsageLog(
  input: RecordUsageLogInput
): Promise<AssetUsageLog> {
  const numericValue =
    typeof input.value === "string" ? parseFloat(input.value) : input.value;

  if (isNaN(numericValue) || numericValue < 0) {
    throw new InvalidTelemetryValueError("Telemetry reading must be a non-negative number");
  }

  // Check monotonic non-decreasing rule against previous reading
  const [latestLog] = await db
    .select()
    .from(assetUsageLogs)
    .where(
      and(
        eq(assetUsageLogs.tenantId, input.tenantId),
        eq(assetUsageLogs.assetId, input.assetId),
        eq(assetUsageLogs.metricType, input.metricType)
      )
    )
    .orderBy(desc(assetUsageLogs.recordedAt), desc(assetUsageLogs.createdAt))
    .limit(1);

  if (latestLog && !input.allowMeterReplacement) {
    const prevValue = parseFloat(latestLog.value);
    if (numericValue < prevValue) {
      throw new InvalidTelemetryValueError(
        `Telemetry reading (${numericValue}) cannot be lower than previously recorded reading (${prevValue}) without replacement authorization.`
      );
    }
  }

  const validated = insertAssetUsageLogSchema.parse({
    tenantId: input.tenantId,
    assetId: input.assetId,
    metricType: input.metricType,
    value: numericValue.toFixed(2),
    notes: input.notes ?? null,
    recordedBy: input.recordedBy ?? null,
    recordedAt: input.recordedAt ?? new Date(),
  });

  const [inserted] = await db.insert(assetUsageLogs).values(validated).returning();

  await recordAuditLog({
    tenantId: inserted.tenantId,
    userId: inserted.recordedBy,
    action: "RECORD_USAGE_LOG",
    entityType: "asset_usage_log",
    entityId: inserted.id,
    newData: inserted as unknown as Record<string, unknown>,
  });

  return inserted;
}

export async function getLatestUsageLog(
  tenantId: string,
  assetId: string,
  metricType?: AssetUsageMetricType
): Promise<AssetUsageLog | null> {
  const conditions = [
    eq(assetUsageLogs.tenantId, tenantId),
    eq(assetUsageLogs.assetId, assetId),
  ];

  if (metricType) {
    conditions.push(eq(assetUsageLogs.metricType, metricType));
  }

  const [log] = await db
    .select()
    .from(assetUsageLogs)
    .where(and(...conditions))
    .orderBy(desc(assetUsageLogs.recordedAt), desc(assetUsageLogs.createdAt))
    .limit(1);

  return log ?? null;
}

export interface ListUsageLogsParams {
  tenantId: string;
  assetId: string;
  metricType?: AssetUsageMetricType;
  cursor?: string;
  limit?: number;
}

export async function listUsageLogs(
  params: ListUsageLogsParams
): Promise<PaginatedResult<AssetUsageLog>> {
  const limit = params.limit ?? 10;
  const conditions = [
    eq(assetUsageLogs.tenantId, params.tenantId),
    eq(assetUsageLogs.assetId, params.assetId),
  ];

  if (params.metricType) {
    conditions.push(eq(assetUsageLogs.metricType, params.metricType));
  }

  if (params.cursor) {
    const decoded = decodeCursor(params.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      conditions.push(
        or(
          lt(assetUsageLogs.createdAt, cursorDate),
          and(eq(assetUsageLogs.createdAt, cursorDate), lt(assetUsageLogs.id, decoded.id))
        )!
      );
    }
  }

  const rows = await db
    .select()
    .from(assetUsageLogs)
    .where(and(...conditions))
    .orderBy(desc(assetUsageLogs.createdAt), desc(assetUsageLogs.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const lastItem = items[items.length - 1];
    nextCursor = encodeCursor({
      createdAt: lastItem.createdAt,
      id: lastItem.id,
    });
  }

  return {
    items,
    nextCursor,
    hasMore,
  };
}
