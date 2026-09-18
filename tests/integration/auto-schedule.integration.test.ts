import { describe, it, expect, beforeAll } from "vitest";
import { completeMaintenanceOrder } from "@/core/assets/services/maintenance-service";
import { db } from "@/db";
import {
  tenants,
  users,
  assets,
  maintenancePlans,
  maintenanceOrders,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Auto-schedule next order (Integration)", () => {
  const tenantB = "4fa85f64-5717-4562-b3fc-2c963f66afb6";
  const userB = "4fa85f64-5717-4562-b3fc-2c963f66af11";
  const assetB = "4fa85f64-5717-4562-b3fc-2c963f66afb8";

  beforeAll(async () => {
    await db
      .insert(tenants)
      .values({
        id: tenantB,
        name: "Tenant Test AutoSchedule",
        slug: "tenant-test-autoschedule-slug",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: userB,
        email: "user-autoschedule-test@example.com",
        fullName: "Test User AutoSchedule",
      })
      .onConflictDoNothing();

    await db
      .insert(assets)
      .values({
        id: assetB,
        tenantId: tenantB,
        name: "Montacargas AutoSchedule",
        type: "HEAVY_MACHINERY",
        status: "OPERATIONAL",
        customFields: { engineModel: "E-2000" },
        createdBy: userB,
      })
      .onConflictDoNothing();
  });

  it("completes an order and auto-schedules the next one with updated plan baseline", async () => {
    // 1. Create a plan with a usage baseline
    const [plan] = await db
      .insert(maintenancePlans)
      .values({
        tenantId: tenantB,
        assetId: assetB,
        name: "Cambio de filtro hidráulico",
        metricType: "HOURS_OPERATED",
        intervalValue: "500.00",
        baselineUsage: "1000.00",
        isActive: true,
        createdBy: userB,
      })
      .returning();

    // 2. Create an order linked to the plan
    const [order] = await db
      .insert(maintenanceOrders)
      .values({
        tenantId: tenantB,
        assetId: assetB,
        planId: plan.id,
        orderType: "PREVENTIVE",
        status: "SCHEDULED",
        title: "Cambio de filtro hidráulico",
        createdBy: userB,
      })
      .returning();

    // 3. Complete the order with a usage reading
    const result = await completeMaintenanceOrder({
      tenantId: tenantB,
      orderId: order.id,
      usageAtService: "2000.00",
      userId: userB,
    });

    // 4. A next order must exist with dueUsage = usageAtService + interval
    expect(result.order.status).toBe("COMPLETED");
    expect(result.nextOrder).not.toBeNull();
    expect(result.nextOrder?.planId).toBe(plan.id);
    expect(parseFloat(result.nextOrder!.dueUsage!)).toBeCloseTo(2500);

    // 5. The plan baseline was updated to the completion usage
    const [updatedPlan] = await db
      .select()
      .from(maintenancePlans)
      .where(eq(maintenancePlans.id, plan.id));

    expect(updatedPlan.baselineUsage).toBe("2000.00");
    expect(updatedPlan.baselineDate).not.toBeNull();
  });
});
