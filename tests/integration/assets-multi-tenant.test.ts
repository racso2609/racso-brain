import { describe, it, expect, beforeAll } from "vitest";
import {
  createAsset,
  getAssetById,
  listAssets,
} from "@/core/assets/services/asset-service";
import {
  recordUsageLog,
  InvalidTelemetryValueError,
} from "@/core/assets/services/usage-log-service";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";

describe("Assets Multi-Tenant Isolation & Telemetry Monotonicity", () => {
  const tenantA = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
  const tenantB = "3fa85f64-5717-4562-b3fc-2c963f66afb7";
  const userA = "3fa85f64-5717-4562-b3fc-2c963f66af01";

  beforeAll(async () => {
    await db
      .insert(tenants)
      .values([
        {
          id: tenantA,
          name: "Tenant Multi A",
          slug: "tenant-multi-a-slug",
        },
        {
          id: tenantB,
          name: "Tenant Multi B",
          slug: "tenant-multi-b-slug",
        },
      ])
      .onConflictDoNothing();

    await db
      .insert(users)
      .values({
        id: userA,
        email: "user-multi-test@example.com",
        fullName: "Test User Multi",
      })
      .onConflictDoNothing();
  });

  it("ensures strict anti-leakage: Tenant A cannot retrieve Tenant B asset", async () => {
    // Create asset in tenant B
    const assetB = await createAsset({
      tenantId: tenantB,
      name: "Compresor Tenant B",
      type: "EQUIPMENT",
      customFields: {
        manufacturer: "DeWalt",
        ratedPowerKw: 5.5,
      },
      createdBy: userA,
    });

    // Attempt to access with tenant A ID must return null
    const foundByTenantA = await getAssetById(tenantA, assetB.id);
    expect(foundByTenantA).toBeNull();

    // Access with tenant B ID must succeed
    const foundByTenantB = await getAssetById(tenantB, assetB.id);
    expect(foundByTenantB).not.toBeNull();
    expect(foundByTenantB?.id).toBe(assetB.id);
  });

  it("enforces telemetry monotonicity: rejects reading lower than prior value unless flag is set", async () => {
    const asset = await createAsset({
      tenantId: tenantA,
      name: "Camión Reparto 05",
      type: "VEHICLE",
      customFields: {
        brand: "Isuzu",
        model: "NPR",
        year: 2020,
        fuelType: "DIESEL",
      },
      createdBy: userA,
    });

    // 1. Initial reading: 50,000 km
    await recordUsageLog({
      tenantId: tenantA,
      assetId: asset.id,
      metricType: "ODOMETER_KM",
      value: "50000.00",
      recordedBy: userA,
    });

    // 2. Subsequent reading: 52,000 km -> should pass
    const log2 = await recordUsageLog({
      tenantId: tenantA,
      assetId: asset.id,
      metricType: "ODOMETER_KM",
      value: "52000.00",
      recordedBy: userA,
    });
    expect(log2.value).toBe("52000.00");

    // 3. Regressive reading: 48,000 km -> must throw InvalidTelemetryValueError
    await expect(
      recordUsageLog({
        tenantId: tenantA,
        assetId: asset.id,
        metricType: "ODOMETER_KM",
        value: "48000.00",
        recordedBy: userA,
      })
    ).rejects.toThrow(InvalidTelemetryValueError);

    // 4. Regressive reading with allowMeterReplacement: true -> allowed with note
    const logReplacement = await recordUsageLog({
      tenantId: tenantA,
      assetId: asset.id,
      metricType: "ODOMETER_KM",
      value: "150.00",
      allowMeterReplacement: true,
      notes: "Sustitución de tablero de instrumentos por avería",
      recordedBy: userA,
    });
    expect(logReplacement.value).toBe("150.00");
  });

  it("supports keyset cursor-based pagination for listing assets", async () => {
    const page = await listAssets({
      tenantId: tenantA,
      limit: 2,
    });

    expect(page.items).toBeDefined();
    expect(page.items.length).toBeLessThanOrEqual(2);
    expect(typeof page.hasMore).toBe("boolean");
  });
});
