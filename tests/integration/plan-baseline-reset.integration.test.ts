import { describe, it, expect, beforeAll } from "vitest";
import {
  createMaintenanceOrder,
  completeMaintenanceOrder,
} from "@/core/assets/services/maintenance-service";
import { db } from "@/db";
import {
  tenants,
  users,
  assets,
  maintenancePlans,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Plan baseline reset on order creation (Integration)", () => {
  const tenantB = "4fa85f64-5717-4562-b3fc-2c963f66afb6";
  const userB = "4fa85f64-5717-4562-b3fc-2c963f66af11";
  const assetB = "4fa85f64-5717-4562-b3fc-2c963f66afb8";

  beforeAll(async () => {
    await db
      .insert(tenants)
      .values({
        id: tenantB,
        name: "Tenant Test PlazoBaseline",
        slug: "tenant-test-baseline-slug",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: userB,
        email: "user-baseline-test@example.com",
        fullName: "Test User Baseline",
      })
      .onConflictDoNothing();

    await db
      .insert(assets)
      .values({
        id: assetB,
        tenantId: tenantB,
        name: "Montacargas Baseline",
        type: "HEAVY_MACHINERY",
        status: "OPERATIONAL",
        customFields: { engineModel: "E-2000" },
        createdBy: userB,
      })
      .onConflictDoNothing();
  });

  it("creates an order linked to a plan with a service reading and resets the plan baseline", async () => {
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

    // 2. Create an order manually linked to the plan, with the service reading
    const result = await createMaintenanceOrder({
      tenantId: tenantB,
      assetId: assetB,
      planId: plan.id,
      orderType: "PREVENTIVE",
      title: "Cambio de filtro hidráulico",
      usageAtService: "2000.00",
      serviceDate: "2026-09-18",
      createdBy: userB,
    });

    expect(result.order.status).toBe("SCHEDULED");

    // 3. The plan baseline was moved forward to the service reading
    const [updatedPlan] = await db
      .select()
      .from(maintenancePlans)
      .where(eq(maintenancePlans.id, plan.id));

    expect(updatedPlan.baselineUsage).toBe("2000.00");
    expect(updatedPlan.baselineDate).not.toBeNull();
  });

  it("completing an order does NOT create a next order automatically", async () => {
    // 1. Create a plan with a usage baseline
    const [plan] = await db
      .insert(maintenancePlans)
      .values({
        tenantId: tenantB,
        assetId: assetB,
        name: "Cambio de aceite de motor",
        metricType: "HOURS_OPERATED",
        intervalValue: "250.00",
        baselineUsage: "1000.00",
        isActive: true,
        createdBy: userB,
      })
      .returning();

    // 2. Create an order linked to the plan
    const created = await createMaintenanceOrder({
      tenantId: tenantB,
      assetId: assetB,
      planId: plan.id,
      orderType: "PREVENTIVE",
      title: "Cambio de aceite de motor",
      createdBy: userB,
    });

    // 3. Complete the order with a usage reading
    const result = await completeMaintenanceOrder({
      tenantId: tenantB,
      orderId: created.order.id,
      usageAtService: "1250.00",
      userId: userB,
    });

    expect(result.order.status).toBe("COMPLETED");

    // 4. No next order was auto-generated; irrelevant extra orders (if any)
    // must be absent — completion only flips status.
    expect(result).not.toHaveProperty("nextOrder");
  });
});