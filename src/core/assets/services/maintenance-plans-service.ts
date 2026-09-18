import { db } from "@/db";
import {
  maintenancePlans,
  maintenanceOrders,
  insertMaintenancePlanSchema,
  type MaintenancePlan,
} from "@/db/schema";
import type { AssetUsageMetricType } from "@/core/assets/types";
import { eq, and, or, lt, desc } from "drizzle-orm";
import { encodeCursor, decodeCursor } from "@/lib/pagination/cursor";
import type { PaginatedResult } from "@/lib/pagination/types";
import { recordAuditLog } from "@/core/audit/service";

export interface CreateMaintenancePlanInput {
  tenantId: string;
  assetId: string;
  name: string;
  description?: string | null;
  metricType: AssetUsageMetricType;
  intervalValue: string | number;
  intervalDays?: number | null;
  alertThresholdPercentage?: number;
  baselineUsage?: string | number | null;
  baselineDate?: string | Date | null;
  createdBy?: string | null;
}

export async function createMaintenancePlan(
  input: CreateMaintenancePlanInput
): Promise<MaintenancePlan> {
  const validated = insertMaintenancePlanSchema.parse({
    tenantId: input.tenantId,
    assetId: input.assetId,
    name: input.name,
    description: input.description ?? null,
    metricType: input.metricType,
    intervalValue: String(input.intervalValue),
    intervalDays: input.intervalDays ?? null,
    alertThresholdPercentage: input.alertThresholdPercentage ?? 90,
    baselineUsage:
      input.baselineUsage != null ? String(input.baselineUsage) : null,
    baselineDate:
      input.baselineDate != null
        ? input.baselineDate instanceof Date
          ? input.baselineDate
          : new Date(input.baselineDate)
        : null,
    createdBy: input.createdBy ?? null,
  });

  return await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(maintenancePlans)
      .values(validated)
      .returning();

    // Auto-create the first SCHEDULED order when a usage baseline + interval are provided
    if (input.baselineUsage != null && input.intervalValue != null) {
      const baseline = parseFloat(String(input.baselineUsage));
      const interval = parseFloat(String(input.intervalValue));
      const dueUsage = baseline + interval;

      await tx
        .insert(maintenanceOrders)
        .values({
          tenantId: input.tenantId,
          assetId: input.assetId,
          planId: plan.id,
          orderType: "PREVENTIVE",
          status: "SCHEDULED",
          title: plan.name,
          description: plan.description,
          dueUsage: String(dueUsage),
          createdBy: input.createdBy ?? null,
        });
    }

    await recordAuditLog({
      tenantId: input.tenantId,
      userId: input.createdBy,
      action: "CREATE_MAINTENANCE_PLAN",
      entityType: "maintenance_plan",
      entityId: plan.id,
      newData: plan as unknown as Record<string, unknown>,
    });

    return plan;
  });
}

export interface ListMaintenancePlansInput {
  tenantId: string;
  assetId?: string;
  cursor?: string;
  limit?: number;
}

export async function listMaintenancePlans(
  input: ListMaintenancePlansInput
): Promise<PaginatedResult<MaintenancePlan>> {
  const limit = input.limit ?? 10;
  const conditions = [eq(maintenancePlans.tenantId, input.tenantId)];

  if (input.assetId) {
    conditions.push(eq(maintenancePlans.assetId, input.assetId));
  }

  if (input.cursor) {
    const decoded = decodeCursor(input.cursor);
    if (decoded) {
      const cursorDate = new Date(decoded.createdAt);
      conditions.push(
        or(
          lt(maintenancePlans.createdAt, cursorDate),
          and(eq(maintenancePlans.createdAt, cursorDate), lt(maintenancePlans.id, decoded.id))
        )!
      );
    }
  }

  const rows = await db
    .select()
    .from(maintenancePlans)
    .where(and(...conditions))
    .orderBy(desc(maintenancePlans.createdAt), desc(maintenancePlans.id))
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

export interface UpdateMaintenancePlanInput {
  tenantId: string;
  planId: string;
  isActive?: boolean;
  intervalValue?: string | number;
  baselineUsage?: string | number | null;
  baselineDate?: string | Date | null;
  userId?: string | null;
}

export async function updateMaintenancePlan(
  input: UpdateMaintenancePlanInput
): Promise<MaintenancePlan> {
  const [existing] = await db
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.id, input.planId),
        eq(maintenancePlans.tenantId, input.tenantId)
      )
    );

  if (!existing) {
    throw new Error(`Maintenance plan ${input.planId} not found in this tenant`);
  }

  const [updated] = await db
    .update(maintenancePlans)
    .set({
      isActive: input.isActive ?? existing.isActive,
      intervalValue:
        input.intervalValue !== undefined
          ? String(input.intervalValue)
          : existing.intervalValue,
      baselineUsage:
        input.baselineUsage !== undefined
          ? input.baselineUsage != null
            ? String(input.baselineUsage)
            : null
          : existing.baselineUsage,
      baselineDate:
        input.baselineDate !== undefined
          ? input.baselineDate != null
            ? input.baselineDate instanceof Date
              ? input.baselineDate
              : new Date(input.baselineDate)
            : null
          : existing.baselineDate,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(maintenancePlans.id, input.planId),
        eq(maintenancePlans.tenantId, input.tenantId)
      )
    )
    .returning();

  await recordAuditLog({
    tenantId: input.tenantId,
    userId: input.userId,
    action: "UPDATE_MAINTENANCE_PLAN",
    entityType: "maintenance_plan",
    entityId: updated.id,
    oldData: existing as unknown as Record<string, unknown>,
    newData: updated as unknown as Record<string, unknown>,
  });

  return updated;
}
