import { z } from "zod";

export const assetTypeValues = [
  "VEHICLE",
  "HVAC",
  "HEAVY_MACHINERY",
  "EQUIPMENT",
  "FACILITY",
] as const;
export type AssetType = (typeof assetTypeValues)[number];

export const assetStatusValues = [
  "OPERATIONAL",
  "UNDER_MAINTENANCE",
  "DECOMMISSIONED",
] as const;
export type AssetStatus = (typeof assetStatusValues)[number];

export const assetUsageMetricTypeValues = [
  "ODOMETER_KM",
  "HOURS_OPERATED",
  "CYCLES",
  "CALENDAR_DAYS",
] as const;
export type AssetUsageMetricType = (typeof assetUsageMetricTypeValues)[number];

export const maintenanceOrderTypeValues = [
  "PREVENTIVE",
  "CORRECTIVE",
] as const;
export type MaintenanceOrderType = (typeof maintenanceOrderTypeValues)[number];

export const maintenanceOrderStatusValues = [
  "SCHEDULED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export type MaintenanceOrderStatus = (typeof maintenanceOrderStatusValues)[number];

export const maintenancePaymentTermsValues = [
  "IMMEDIATE",
  "CREDIT_15_DAYS",
  "CREDIT_30_DAYS",
  "CREDIT_60_DAYS",
] as const;
export type MaintenancePaymentTerms = (typeof maintenancePaymentTermsValues)[number];

// Polymorphic custom field schemas
export const vehicleCustomFieldsSchema = z.object({
  vin: z.string().optional(),
  licensePlate: z.string().optional(),
  brand: z.string().min(1, "Brand is required"),
  model: z.string().min(1, "Model is required"),
  year: z.number().int().min(1900).max(2100),
  fuelType: z.enum(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID"]),
});
export type VehicleCustomFields = z.infer<typeof vehicleCustomFieldsSchema>;

export const hvacCustomFieldsSchema = z.object({
  btuCapacity: z.number().positive("BTU capacity must be positive"),
  refrigerantType: z.string().min(1, "Refrigerant type is required"),
  locationZone: z.string().min(1, "Location zone is required"),
  filterType: z.string().optional(),
});
export type HvacCustomFields = z.infer<typeof hvacCustomFieldsSchema>;

export const heavyMachineryCustomFieldsSchema = z.object({
  engineModel: z.string().min(1, "Engine model is required"),
  operatingWeightTons: z.number().positive().optional(),
  fuelCapacityLiters: z.number().positive().optional(),
});
export type HeavyMachineryCustomFields = z.infer<typeof heavyMachineryCustomFieldsSchema>;

export const equipmentCustomFieldsSchema = z.object({
  manufacturer: z.string().min(1, "Manufacturer is required"),
  powerVoltage: z.string().optional(),
  ratedPowerKw: z.number().positive().optional(),
});
export type EquipmentCustomFields = z.infer<typeof equipmentCustomFieldsSchema>;

export const facilityCustomFieldsSchema = z.object({
  squareMeters: z.number().positive().optional(),
  floorOrSector: z.string().min(1, "Floor or sector is required"),
  emergencyContact: z.string().optional(),
});
export type FacilityCustomFields = z.infer<typeof facilityCustomFieldsSchema>;

export const polymorphicSchemas: Record<AssetType, z.ZodSchema> = {
  VEHICLE: vehicleCustomFieldsSchema,
  HVAC: hvacCustomFieldsSchema,
  HEAVY_MACHINERY: heavyMachineryCustomFieldsSchema,
  EQUIPMENT: equipmentCustomFieldsSchema,
  FACILITY: facilityCustomFieldsSchema,
};

export function validateAssetCustomFields(type: AssetType, fields: unknown) {
  const schema = polymorphicSchemas[type];
  if (!schema) {
    throw new Error(`Unsupported asset type: ${type}`);
  }
  return schema.parse(fields ?? {});
}

// Parts replaced schema
export const partReplacedSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().min(0),
  partNumber: z.string().optional(),
});
export type PartReplaced = z.infer<typeof partReplacedSchema>;
