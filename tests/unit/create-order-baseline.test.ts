import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, recordAuditLogMock } = vi.hoisted(() => ({
  dbMock: { transaction: vi.fn() },
  recordAuditLogMock: vi.fn(),
}));

vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/core/audit/service", () => ({
  recordAuditLog: (...args: unknown[]) => recordAuditLogMock(...args),
}));

import { createMaintenanceOrder } from "@/core/assets/services/maintenance-service";

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

describe("Create maintenance order resets plan baseline", () => {
  beforeEach(() => {
    recordAuditLogMock.mockReset();
    recordAuditLogMock.mockResolvedValue(null);
    dbMock.transaction.mockReset();
  });

  it("resets the plan baseline when the order carries planId and usageAtService", async () => {
    const asset = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Test Camion", type: "VEHICLE" };
    const plan = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      name: "Cambio de aceite",
      metricType: "ODOMETER_KM",
      intervalValue: "5000.00",
      baselineUsage: "10000.00",
      baselineDate: "2026-01-01",
      isActive: true,
    };
    const order = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      planId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      status: "SCHEDULED",
      cost: "0.00",
    };
    const updatedPlan = {
      ...plan,
      baselineUsage: "52500.00",
      baselineDate: "2026-09-18",
    };

    const { tx, updateChains, selectChains } = buildTx({
      selectResults: [[asset], [plan]],
      updateResults: [[updatedPlan]],
      insertResults: [[order]],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    const result = await createMaintenanceOrder({
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      planId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      orderType: "PREVENTIVE",
      title: "Cambio de aceite",
      usageAtService: "52500.00",
      serviceDate: "2026-09-18",
      createdBy: "3fa85f64-5717-4562-b3fc-2c963f66af01",
    });

    expect(result.order.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13");

    // Plan update used the service reading as the new baseline
    const planSet = updateChains[0].captured.set[0] as {
      baselineUsage: string;
      baselineDate: string;
    };
    expect(planSet.baselineUsage).toBe("52500.00");
    expect(planSet.baselineDate).toEqual(new Date("2026-09-18T00:00:00.000Z"));

    // Two selects: asset + plan lookup
    expect(selectChains).toHaveLength(2);
  });

  it("does NOT reset the plan baseline when no usageAtService is provided", async () => {
    const asset = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Test Camion", type: "VEHICLE" };
    const order = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      planId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      status: "SCHEDULED",
      cost: "0.00",
    };

    const { tx, selectChains, updateChains } = buildTx({
      selectResults: [[asset]],
      updateResults: [],
      insertResults: [[order]],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    const result = await createMaintenanceOrder({
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      planId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      orderType: "PREVENTIVE",
      title: "Cambio de aceite",
      createdBy: "3fa85f64-5717-4562-b3fc-2c963f66af01",
    });

    expect(result.order.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13");
    // Only the asset lookup; no plan fetch or update
    expect(selectChains).toHaveLength(1);
    expect(updateChains).toHaveLength(0);
  });

  it("does NOT reset the plan baseline when there is no planId", async () => {
    const asset = { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6", name: "Test Camion", type: "VEHICLE" };
    const order = {
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      planId: null,
      status: "SCHEDULED",
      cost: "0.00",
    };

    const { tx, selectChains, updateChains } = buildTx({
      selectResults: [[asset]],
      updateResults: [],
      insertResults: [[order]],
    });
    dbMock.transaction.mockImplementation(async (cb: (t: unknown) => unknown) =>
      cb(tx)
    );

    const result = await createMaintenanceOrder({
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      assetId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      orderType: "PREVENTIVE",
      title: "Inspección general",
      usageAtService: "52500.00",
      createdBy: "3fa85f64-5717-4562-b3fc-2c963f66af01",
    });

    expect(result.order.id).toBe("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13");
    expect(selectChains).toHaveLength(1);
    expect(updateChains).toHaveLength(0);
  });
});