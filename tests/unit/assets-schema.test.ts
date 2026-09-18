import { describe, it, expect } from "vitest";
import {
  assets,
  assetUsageLogs,
  maintenancePlans,
  maintenanceOrders,
  assetTypeValues,
  assetStatusValues,
  assetUsageMetricTypeValues,
  maintenanceOrderTypeValues,
  maintenanceOrderStatusValues,
  maintenancePaymentTermsValues,
  insertAssetSchema,
  insertAssetUsageLogSchema,
  insertMaintenancePlanSchema,
  insertMaintenanceOrderSchema,
} from "@/db/schema";
import {
  vehicleCustomFieldsSchema,
  hvacCustomFieldsSchema,
  heavyMachineryCustomFieldsSchema,
  equipmentCustomFieldsSchema,
  facilityCustomFieldsSchema,
  validateAssetCustomFields,
} from "@/core/assets/types";

describe("Assets & Maintenance Schemas (Task 1 TDD)", () => {
  it("exports all tables and enum values matching SDD Feature 2", () => {
    expect(assets).toBeDefined();
    expect(assetUsageLogs).toBeDefined();
    expect(maintenancePlans).toBeDefined();
    expect(maintenanceOrders).toBeDefined();

    expect(assetTypeValues).toEqual([
      "VEHICLE",
      "HVAC",
      "HEAVY_MACHINERY",
      "EQUIPMENT",
      "FACILITY",
    ]);

    expect(assetStatusValues).toEqual([
      "OPERATIONAL",
      "UNDER_MAINTENANCE",
      "DECOMMISSIONED",
    ]);

    expect(assetUsageMetricTypeValues).toEqual([
      "ODOMETER_KM",
      "HOURS_OPERATED",
      "CYCLES",
      "CALENDAR_DAYS",
    ]);

    expect(maintenanceOrderTypeValues).toEqual([
      "PREVENTIVE",
      "CORRECTIVE",
    ]);

    expect(maintenanceOrderStatusValues).toEqual([
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ]);

    expect(maintenancePaymentTermsValues).toEqual([
      "IMMEDIATE",
      "CREDIT_15_DAYS",
      "CREDIT_30_DAYS",
      "CREDIT_60_DAYS",
    ]);
  });

  it("validates polymorphic custom_fields for VEHICLE", () => {
    const validVehicle = {
      brand: "Toyota",
      model: "Hilux",
      year: 2022,
      fuelType: "DIESEL" as const,
      licensePlate: "AB123CD",
      vin: "1HGCR2F83HA000000",
    };

    const parsed = vehicleCustomFieldsSchema.parse(validVehicle);
    expect(parsed.brand).toBe("Toyota");
    expect(parsed.fuelType).toBe("DIESEL");

    const validatedPolymorphic = validateAssetCustomFields("VEHICLE", validVehicle);
    expect(validatedPolymorphic).toEqual(validVehicle);

    // Invalid fuel type
    expect(() =>
      validateAssetCustomFields("VEHICLE", {
        ...validVehicle,
        fuelType: "KEROSENE",
      })
    ).toThrow();
  });

  it("validates polymorphic custom_fields for HVAC, HEAVY_MACHINERY, EQUIPMENT, and FACILITY", () => {
    // HVAC
    const validHvac = {
      btuCapacity: 24000,
      refrigerantType: "R410A",
      locationZone: "Piso 3 Ala Norte",
    };
    expect(validateAssetCustomFields("HVAC", validHvac)).toEqual(validHvac);
    expect(() => validateAssetCustomFields("HVAC", { btuCapacity: -500 })).toThrow();

    // HEAVY_MACHINERY
    const validMachinery = {
      engineModel: "CAT-C9",
      operatingWeightTons: 22.5,
    };
    expect(validateAssetCustomFields("HEAVY_MACHINERY", validMachinery)).toEqual(validMachinery);

    // EQUIPMENT
    const validEquipment = {
      manufacturer: "Atlas Copco",
      ratedPowerKw: 15.5,
    };
    expect(validateAssetCustomFields("EQUIPMENT", validEquipment)).toEqual(validEquipment);

    // FACILITY
    const validFacility = {
      floorOrSector: "Bodega B",
      squareMeters: 450,
    };
    expect(validateAssetCustomFields("FACILITY", validFacility)).toEqual(validFacility);
  });

  it("validates Drizzle insert schemas for assets, usage logs, plans, and orders", () => {
    const tenantId = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
    const assetId = "4ba85f64-5717-4562-b3fc-2c963f66afa7";

    const assetData = insertAssetSchema.parse({
      tenantId,
      name: "Camioneta Operativa #1",
      type: "VEHICLE",
      status: "OPERATIONAL",
      customFields: {
        brand: "Ford",
        model: "Ranger",
        year: 2021,
        fuelType: "DIESEL",
      },
    });
    expect(assetData.name).toBe("Camioneta Operativa #1");

    const usageLogData = insertAssetUsageLogSchema.parse({
      tenantId,
      assetId,
      metricType: "ODOMETER_KM",
      value: "125000.50",
    });
    expect(usageLogData.metricType).toBe("ODOMETER_KM");

    const planData = insertMaintenancePlanSchema.parse({
      tenantId,
      assetType: "VEHICLE",
      name: "Servicio cada 5000 km",
      metricType: "ODOMETER_KM",
      intervalValue: "5000.00",
      intervalDays: 180,
    });
    expect(planData.alertThresholdPercentage).toBe(90);

    const orderData = insertMaintenanceOrderSchema.parse({
      tenantId,
      assetId,
      orderType: "PREVENTIVE",
      status: "SCHEDULED",
      title: "Cambio de aceite y filtros",
      cost: "150.00",
      paymentTerms: "CREDIT_30_DAYS",
    });
    expect(orderData.title).toBe("Cambio de aceite y filtros");
  });
});
