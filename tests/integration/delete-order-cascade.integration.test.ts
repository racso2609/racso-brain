import { describe, it, expect, beforeAll } from "vitest";
import {
  createMaintenanceOrder,
  deleteMaintenanceOrder,
} from "@/core/assets/services/maintenance-service";
import { db } from "@/db";
import {
  tenants,
  users,
  assets,
  maintenanceOrders,
  financialTransactions,
} from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Delete Order Cascade (DB trigger deletes ledger tx)", () => {
  const tenantA = "7fa85f64-5717-4562-b3fc-2c963f66df10";
  const userA = "7fa85f64-5717-4562-b3fc-2c963f66df11";
  const assetA = "7fa85f64-5717-4562-b3fc-2c963f66df12";

  beforeAll(async () => {
    await db
      .insert(tenants)
      .values({
        id: tenantA,
        name: "Tenant Delete Cascade",
        slug: "tenant-delete-cascade-slug",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: userA,
        email: "user-delete-cascade@example.com",
        fullName: "Test User Delete Cascade",
      })
      .onConflictDoNothing();

    await db
      .insert(assets)
      .values({
        id: assetA,
        tenantId: tenantA,
        name: "Camión Delete Cascade",
        type: "VEHICLE",
        status: "OPERATIONAL",
        createdBy: userA,
      })
      .onConflictDoNothing();
  });

  it("deletes the order and cascades deletion of its financial transaction via trigger", async () => {
    const created = await createMaintenanceOrder({
      tenantId: tenantA,
      assetId: assetA,
      orderType: "PREVENTIVE",
      title: "Orden a Eliminar con Tx",
      cost: "350.00",
      currency: "USD",
      paymentTerms: "IMMEDIATE",
      serviceDate: "2026-09-17",
      createdBy: userA,
    });

    expect(created.order).toBeDefined();
    expect(created.financialTransaction).toBeDefined();
    const txId = created.financialTransaction!.id;
    const orderId = created.order.id;

    const result = await deleteMaintenanceOrder({
      tenantId: tenantA,
      orderId,
      userId: userA,
    });

    expect(result.deletedOrderId).toBe(orderId);
    expect(result.deletedTransactionId).toBe(txId);

    const [orderAfter] = await db
      .select()
      .from(maintenanceOrders)
      .where(eq(maintenanceOrders.id, orderId));
    expect(orderAfter).toBeUndefined();

    const [txAfter] = await db
      .select()
      .from(financialTransactions)
      .where(eq(financialTransactions.id, txId));
    expect(txAfter).toBeUndefined();
  });
});
