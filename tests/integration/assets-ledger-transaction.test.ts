import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  createMaintenanceOrder,
  cancelMaintenanceOrder,
} from "@/core/assets/services/maintenance-service";
import { db } from "@/db";
import { tenants, users, assets } from "@/db/schema";

describe("Assets & Financial Ledger Integration (Atomic db.transaction)", () => {
  const tenantA = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const userA = "3fa85f64-5717-4562-b3fc-2c963f66af01";
  const assetA = "3fa85f64-5717-4562-b3fc-2c963f66afa8";

  beforeAll(async () => {
    await db
      .insert(tenants)
      .values({
        id: tenantA,
        name: "Tenant Test Ledger",
        slug: "tenant-test-ledger-slug",
      })
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: userA,
        email: "user-ledger-test@example.com",
        fullName: "Test User Ledger",
      })
      .onConflictDoNothing();

    await db
      .insert(assets)
      .values({
        id: assetA,
        tenantId: tenantA,
        name: "Camión Reparto Test",
        type: "VEHICLE",
        status: "OPERATIONAL",
        customFields: {
          brand: "Volvo",
          model: "FH",
          year: 2021,
          fuelType: "DIESEL",
        },
        createdBy: userA,
      })
      .onConflictDoNothing();
  });

  it("creates a maintenance order with IMMEDIATE payment and emits EXPENSE (COMMITTED) transaction", async () => {
    const result = await createMaintenanceOrder({
      tenantId: tenantA,
      assetId: assetA,
      orderType: "PREVENTIVE",
      title: "Cambio de Aceite 10W40",
      cost: "120.00",
      currency: "USD",
      paymentTerms: "IMMEDIATE",
      serviceDate: "2026-09-17",
      providerName: "Taller Central",
      invoiceNumber: "INV-9988",
      createdBy: userA,
    });

    expect(result.order).toBeDefined();
    expect(result.order.title).toBe("Cambio de Aceite 10W40");
    expect(result.order.status).toBe("SCHEDULED");
    expect(result.order.cost).toBe("120.00");
    expect(result.financialTransaction).toBeDefined();
    expect(result.financialTransaction?.txType).toBe("EXPENSE");
    expect(result.financialTransaction?.status).toBe("COMMITTED");
    expect(result.financialTransaction?.originModule).toBe("ASSET_MAINTENANCE");
    expect(result.financialTransaction?.originId).toBe(result.order.id);
    expect(result.order.financialTransactionId).toBe(result.financialTransaction?.id);
  });

  it("creates a maintenance order with CREDIT_30_DAYS and emits PAYABLE (PENDING_PAYMENT) with dueDate", async () => {
    const result = await createMaintenanceOrder({
      tenantId: tenantA,
      assetId: assetA,
      orderType: "CORRECTIVE",
      title: "Reemplazo de Embrague",
      cost: "750.50",
      currency: "USD",
      paymentTerms: "CREDIT_30_DAYS",
      serviceDate: "2026-09-10",
      providerName: "Frenos y Embragues del Norte",
      invoiceNumber: "FAC-4412",
      createdBy: userA,
    });

    expect(result.order.cost).toBe("750.50");
    expect(result.financialTransaction?.txType).toBe("PAYABLE");
    expect(result.financialTransaction?.status).toBe("PENDING_PAYMENT");
    // Due date should be 30 days after 2026-09-10 -> 2026-10-10
    expect(result.financialTransaction?.dueDate).toBe("2026-10-10");
  });

  it("creates a zero-cost maintenance order without emitting a financial transaction", async () => {
    const result = await createMaintenanceOrder({
      tenantId: tenantA,
      assetId: assetA,
      orderType: "PREVENTIVE",
      title: "Inspección Visual Rutinaria",
      cost: "0.00",
      paymentTerms: "IMMEDIATE",
      serviceDate: "2026-09-17",
      createdBy: userA,
    });

    expect(result.order).toBeDefined();
    expect(result.financialTransaction).toBeNull();
    expect(result.order.financialTransactionId).toBeNull();
  });

  it("cancels a maintenance order and voids the associated financial transaction", async () => {
    const created = await createMaintenanceOrder({
      tenantId: tenantA,
      assetId: assetA,
      orderType: "PREVENTIVE",
      title: "Orden para Cancelar",
      cost: "200.00",
      paymentTerms: "IMMEDIATE",
      serviceDate: "2026-09-17",
      createdBy: userA,
    });

    const cancelled = await cancelMaintenanceOrder({
      tenantId: tenantA,
      orderId: created.order.id,
      reason: "Proveedor no tenía repuestos",
      userId: userA,
    });

    expect(cancelled.order.status).toBe("CANCELLED");
    expect(cancelled.financialTransaction?.status).toBe("VOIDED");
    expect(
      (cancelled.financialTransaction?.metadata as any)?.voidReason
    ).toBe("Proveedor no tenía repuestos");
  });
});
