import { describe, it, expect, vi, beforeEach } from "vitest";

const hoisted = vi.hoisted(() => {
  const state = {
    orderRow: null as Record<string, unknown> | null,
    txRow: null as Record<string, unknown> | null,
    updatedTx: null as Record<string, unknown> | null,
    deletedOrderId: null as string | null,
  };
  const recordAuditLog = vi.fn();
  const maintenanceOrders = { kind: "maintenanceOrders" };
  const financialTransactions = { kind: "financialTransactions" };
  return { state, recordAuditLog, maintenanceOrders, financialTransactions };
});

vi.mock("@/core/audit/service", () => ({
  recordAuditLog: hoisted.recordAuditLog,
}));

vi.mock("@/db/schema", () => ({
  maintenanceOrders: hoisted.maintenanceOrders,
  financialTransactions: hoisted.financialTransactions,
  assets: {},
  maintenancePlans: {},
  insertMaintenanceOrderSchema: { parse: vi.fn() },
  insertFinancialTransactionSchema: { parse: vi.fn() },
}));

vi.mock("@/db", () => ({
  db: {
    transaction: async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: () => ({
          from: (table: unknown) => ({
            where: async () => {
              if (table === hoisted.maintenanceOrders) {
                return hoisted.state.orderRow ? [hoisted.state.orderRow] : [];
              }
              if (table === hoisted.financialTransactions) {
                return hoisted.state.txRow ? [hoisted.state.txRow] : [];
              }
              return [];
            },
          }),
        }),
        update: (table: unknown) => ({
          set: (data: Record<string, unknown>) => ({
            where: () => {
              if (table === hoisted.financialTransactions) {
                hoisted.state.updatedTx = data;
              }
              return {
                returning: async () => {
                  if (table === hoisted.financialTransactions && hoisted.state.txRow) {
                    return [{ ...hoisted.state.txRow, ...data }];
                  }
                  return [];
                },
              };
            },
          }),
        }),
        delete: (table: unknown) => ({
          where: async () => {
            if (table === hoisted.maintenanceOrders && hoisted.state.orderRow) {
              hoisted.state.deletedOrderId = hoisted.state.orderRow.id as string;
            }
            return [];
          },
        }),
      };
      return cb(tx);
    },
  },
}));

import { deleteMaintenanceOrder } from "@/core/assets/services/maintenance-service";

describe("deleteMaintenanceOrder (unit)", () => {
  beforeEach(() => {
    hoisted.state.orderRow = null;
    hoisted.state.txRow = null;
    hoisted.state.updatedTx = null;
    hoisted.state.deletedOrderId = null;
    hoisted.recordAuditLog.mockReset();
  });

  it("deletes an order with a COMMITTED tx, voiding the tx and deleting the order", async () => {
    hoisted.state.orderRow = {
      id: "order-1",
      tenantId: "tenant-1",
      assetId: "asset-1",
      status: "SCHEDULED",
      financialTransactionId: "tx-1",
    };
    hoisted.state.txRow = {
      id: "tx-1",
      tenantId: "tenant-1",
      status: "COMMITTED",
      metadata: { assetId: "asset-1" },
    };

    const result = await deleteMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-1",
      userId: "user-1",
    });

    expect(result.deletedOrderId).toBe("order-1");
    expect(result.deletedTransactionId).toBe("tx-1");
    expect(hoisted.state.deletedOrderId).toBe("order-1");
    expect(hoisted.state.updatedTx?.status).toBe("VOIDED");
    expect(
      (hoisted.state.updatedTx?.metadata as Record<string, unknown>)?.voidReason
    ).toBe("Order deleted");

    const voidAudit = hoisted.recordAuditLog.mock.calls.find(
      (call) => call[0].action === "VOID_TRANSACTION"
    );
    const deleteAudit = hoisted.recordAuditLog.mock.calls.find(
      (call) => call[0].action === "DELETE_MAINTENANCE_ORDER"
    );
    expect(voidAudit).toBeDefined();
    expect(deleteAudit).toBeDefined();
  });

  it("deletes an order with an already-VOIDED tx without re-voiding it", async () => {
    hoisted.state.orderRow = {
      id: "order-2",
      tenantId: "tenant-1",
      status: "CANCELLED",
      financialTransactionId: "tx-2",
    };
    hoisted.state.txRow = {
      id: "tx-2",
      tenantId: "tenant-1",
      status: "VOIDED",
      metadata: {},
    };

    const result = await deleteMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-2",
    });

    expect(result.deletedOrderId).toBe("order-2");
    expect(result.deletedTransactionId).toBe("tx-2");
    expect(hoisted.state.deletedOrderId).toBe("order-2");
    expect(hoisted.state.updatedTx).toBeNull();

    const voidAudit = hoisted.recordAuditLog.mock.calls.find(
      (call) => call[0].action === "VOID_TRANSACTION"
    );
    expect(voidAudit).toBeUndefined();
  });

  it("deletes an order without a financial transaction without error", async () => {
    hoisted.state.orderRow = {
      id: "order-3",
      tenantId: "tenant-1",
      status: "SCHEDULED",
      financialTransactionId: null,
    };
    hoisted.state.txRow = null;

    const result = await deleteMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-3",
    });

    expect(result.deletedOrderId).toBe("order-3");
    expect(result.deletedTransactionId).toBeNull();
    expect(hoisted.state.deletedOrderId).toBe("order-3");
    expect(hoisted.state.updatedTx).toBeNull();
  });

  it("throws when the order is not found in the tenant", async () => {
    hoisted.state.orderRow = null;

    await expect(
      deleteMaintenanceOrder({ tenantId: "tenant-1", orderId: "missing" })
    ).rejects.toThrow("Maintenance order missing not found in this tenant");
  });
});
