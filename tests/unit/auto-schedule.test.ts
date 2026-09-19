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

function makeActiveUsagePlan() {
  return {
    id: "plan-1",
    tenantId: "tenant-1",
    assetId: "asset-1",
    name: "Cambio de aceite",
    description: null,
    metricType: "HOURS_OPERATED",
    intervalValue: "250.00",
    intervalDays: null,
    isActive: true,
  };
}

describe("Auto-schedule next maintenance order on completion", () => {
  beforeEach(() => {
    recordAuditLogMock.mockReset();
    recordAuditLogMock.mockResolvedValue(null);
    dbMock.transaction.mockReset();
  });

  it("creates a next SCHEDULED order with correct dueUsage for a usage-based active plan", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const completedAt = new Date("2026-09-18T12:00:00.000Z");
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt,
      usageAtService: "5000.00",
    };
    const plan = makeActiveUsagePlan();
    const created = {
      id: "order-2",
      tenantId: "tenant-1",
      assetId: "asset-1",
      planId: "plan-1",
      status: "SCHEDULED",
      dueUsage: "5250",
    };

    const { tx, insertChains, updateChains } = buildTx({
      selectResults: [[existing], [plan]],
      updateResults: [[updated], undefined],
      insertResults: [[created]],
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
    expect(result.nextOrder).not.toBeNull();
    expect(result.nextOrder?.dueUsage).toBe("5250");

    // The insert carried the computed dueUsage (5000 + 250)
    const insertedValues = insertChains[0].captured.values[0] as {
      dueUsage: string;
      orderType: string;
      status: string;
    };
    expect(insertedValues.dueUsage).toBe("5250");
    expect(insertedValues.orderType).toBe("PREVENTIVE");
    expect(insertedValues.status).toBe("SCHEDULED");

    // Plan baseline was updated
    const planSet = updateChains[1].captured.set[0] as {
      baselineUsage: string;
      baselineDate: Date;
    };
    expect(planSet.baselineUsage).toBe("5000.00");
    expect(planSet.baselineDate).toBe(completedAt);
  });

  it("does not create a next order when the order has no planId", async () => {
    const existing = makeOrder({ planId: null, status: "SCHEDULED" });
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt: new Date(),
      usageAtService: "5000.00",
    };

    const { tx, selectChains } = buildTx({
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

    expect(result.nextOrder).toBeNull();
    // Only one select (the order itself) was performed — no plan lookup
    expect(selectChains).toHaveLength(1);
  });

  it("does not create a next order when autoSchedule is false", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt: new Date(),
      usageAtService: "5000.00",
    };

    const { tx, selectChains, insertChains } = buildTx({
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
      autoSchedule: false,
    });

    expect(result.nextOrder).toBeNull();
    // No plan lookup or insert occurred — auto-schedule skipped entirely
    expect(selectChains).toHaveLength(1);
    expect(insertChains).toHaveLength(0);
  });

  it("does not create a next order when the plan is inactive", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt: new Date(),
      usageAtService: "5000.00",
    };
    const plan = { ...makeActiveUsagePlan(), isActive: false };

    const { tx, insertChains } = buildTx({
      selectResults: [[existing], [plan]],
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

    expect(result.nextOrder).toBeNull();
    expect(insertChains).toHaveLength(0);
  });

  it("does not create a next order for a CALENDAR_DAYS metric plan", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt: new Date(),
      usageAtService: "5000.00",
    };
    const plan = {
      ...makeActiveUsagePlan(),
      metricType: "CALENDAR_DAYS",
      intervalValue: "180",
    };

    const { tx, insertChains } = buildTx({
      selectResults: [[existing], [plan]],
      updateResults: [[updated], undefined],
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

    expect(result.nextOrder).toBeNull();
    expect(insertChains).toHaveLength(0);
  });

  it("updates the plan baseline usage and date after completion", async () => {
    const existing = makeOrder({ status: "SCHEDULED" });
    const completedAt = new Date("2026-09-18T12:00:00.000Z");
    const updated = {
      ...existing,
      status: "COMPLETED",
      completedAt,
      usageAtService: "5000.00",
    };
    const plan = makeActiveUsagePlan();
    const created = { id: "order-2", dueUsage: "5250" };

    const { tx, updateChains } = buildTx({
      selectResults: [[existing], [plan]],
      updateResults: [[updated], undefined],
      insertResults: [[created]],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    await completeMaintenanceOrder({
      tenantId: "tenant-1",
      orderId: "order-1",
      usageAtService: "5000.00",
      userId: "user-1",
    });

    const planSet = updateChains[1].captured.set[0] as {
      baselineUsage: string;
      baselineDate: Date;
    };
    expect(planSet.baselineUsage).toBe("5000.00");
    expect(planSet.baselineDate).toBe(completedAt);
  });
});
