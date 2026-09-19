import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, recordAuditLogMock } = vi.hoisted(() => ({
  dbMock: { transaction: vi.fn() },
  recordAuditLogMock: vi.fn(),
}));

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/core/audit/service", () => ({
  recordAuditLog: (...args: unknown[]) => recordAuditLogMock(...args),
}));

import { completeMaintenanceOrder } from "@/core/assets/services/maintenance-service";

type Chain = {
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  then: (...args: unknown[]) => Promise<unknown>;
  captured: { values: unknown[]; set: unknown[] };
};

function makeChain(result: unknown): Chain {
  const promise = Promise.resolve(result);
  const captured: { values: unknown[]; set: unknown[] } = { values: [], set: [] };

  const chain: Chain = {
    values: vi.fn((v: unknown) => {
      captured.values.push(v);
      return chain;
    }),
    set: vi.fn((v: unknown) => {
      captured.set.push(v);
      return chain;
    }),
    where: vi.fn(() => chain),
    from: vi.fn(() => chain),
    returning: vi.fn(() => chain),
    then: promise.then.bind(promise) as Chain["then"],
    captured,
  };

  return chain;
}

function buildTx(config: {
  selectResults: unknown[];
  updateResults: unknown[];
  insertResults: unknown[];
}) {
  const selectChains = config.selectResults.map((r) => makeChain(r));
  const updateChains = config.updateResults.map((r) => makeChain(r));
  const insertChains = config.insertResults.map((r) => makeChain(r));

  const tx = {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  };

  selectChains.forEach((chain) => tx.select.mockReturnValueOnce(chain));
  updateChains.forEach((chain) => tx.update.mockReturnValueOnce(chain));
  insertChains.forEach((chain) => tx.insert.mockReturnValueOnce(chain));

  return { tx, selectChains, updateChains, insertChains };
}

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    tenantId: "tenant-1",
    assetId: "asset-1",
    planId: "plan-1",
    orderType: "PREVENTIVE",
    status: "SCHEDULED",
    title: "Cambio de aceite",
    description: null,
    usageAtService: null,
    completedAt: null,
    partsReplaced: [],
    ...overrides,
  };
}

describe("Complete maintenance order", () => {
  beforeEach(() => {
    recordAuditLogMock.mockReset();
    recordAuditLogMock.mockResolvedValue(null);
    dbMock.transaction.mockReset();
  });

  it("completes the order with status COMPLETED and keeps the usage reading", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const completedAt = new Date("2026-09-18T12:00:00.000Z");
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt,
      usageAtService: "5000.00",
    };

    const { tx, selectChains, updateChains, insertChains } = buildTx({
      selectResults: [[existing]],
      updateResults: [[updated]],
      insertResults: [],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    const result = await completeMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-1",
      usageAtService: "5000.00",
      userId: "user-1",
    });

    expect(result.order.status).toBe("COMPLETED");
    expect(result.order.usageAtService).toBe("5000.00");

    const orderSet = updateChains[0].captured.set[0] as {
      status: string;
      usageAtService: string;
    };
    expect(orderSet.status).toBe("COMPLETED");
    expect(orderSet.usageAtService).toBe("5000.00");

    // Completion no longer touches the plan or inserts a next order
    expect(selectChains).toHaveLength(1);
    expect(insertChains).toHaveLength(0);
    expect(updateChains).toHaveLength(1);
  });

  it("keeps the existing usage reading when none is provided", async () => {
    const existing = makeOrder({
      status: "SCHEDULED",
      usageAtService: "4520.00",
    });
    const updated = { ...existing, status: "COMPLETED" };

    const { tx, updateChains } = buildTx({
      selectResults: [[existing]],
      updateResults: [[updated]],
      insertResults: [],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    await completeMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-1",
      userId: "user-1",
    });

    const orderSet = updateChains[0].captured.set[0] as {
      usageAtService: string;
    };
    expect(orderSet.usageAtService).toBe("4520.00");
  });

  it("throws when the order is already CANCELLED", async () => {
    const existing = makeOrder({ status: "CANCELLED" });

    const { tx } = buildTx({
      selectResults: [[existing]],
      updateResults: [],
      insertResults: [],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    await expect(
      completeMaintenanceOrder({
        tenantId: "tenant-1",
        orderId: "order-1",
        usageAtService: "5000.00",
        userId: "user-1",
      })
    ).rejects.toThrow();
  });
});