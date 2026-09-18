import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  integer,
  boolean,
  date,
  timestamp,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { tenants } from "./tenancy";
import { users } from "./auth";
import { financialTransactions } from "./ledger";
import {
  assetTypeValues,
  assetStatusValues,
  assetUsageMetricTypeValues,
  maintenanceOrderTypeValues,
  maintenanceOrderStatusValues,
  maintenancePaymentTermsValues,
  type PartReplaced,
} from "@/core/assets/types";

export {
  assetTypeValues,
  assetStatusValues,
  assetUsageMetricTypeValues,
  maintenanceOrderTypeValues,
  maintenanceOrderStatusValues,
  maintenancePaymentTermsValues,
};

export const assetTypeEnum = pgEnum("asset_type", assetTypeValues);
export const assetStatusEnum = pgEnum("asset_status", assetStatusValues);
export const assetUsageMetricTypeEnum = pgEnum(
  "asset_usage_metric_type",
  assetUsageMetricTypeValues
);
export const maintenanceOrderTypeEnum = pgEnum(
  "maintenance_order_type",
  maintenanceOrderTypeValues
);
export const maintenanceOrderStatusEnum = pgEnum(
  "maintenance_order_status",
  maintenanceOrderStatusValues
);
export const maintenancePaymentTermsEnum = pgEnum(
  "maintenance_payment_terms",
  maintenancePaymentTermsValues
);

// 1. Assets
export const assets = pgTable(
  "assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: assetTypeEnum("type").notNull(),
    status: assetStatusEnum("status").default("OPERATIONAL").notNull(),
    serialNumber: varchar("serial_number", { length: 255 }),
    customFields: jsonb("custom_fields")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_assets_tenant_type").on(table.tenantId, table.type),
    index("idx_assets_tenant_status").on(table.tenantId, table.status),
    index("idx_assets_cursor").on(table.tenantId, table.createdAt, table.id),
    index("idx_assets_custom_fields").using("gin", table.customFields),
  ]
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

// 2. Asset Usage Logs (Telemetry)
export const assetUsageLogs = pgTable(
  "asset_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    assetId: uuid("asset_id")
      .references(() => assets.id, { onDelete: "cascade" })
      .notNull(),
    metricType: assetUsageMetricTypeEnum("metric_type").notNull(),
    value: numeric("value", { precision: 14, scale: 2 }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    notes: text("notes"),
    recordedBy: uuid("recorded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_usage_logs_asset_metric").on(
      table.tenantId,
      table.assetId,
      table.metricType,
      table.recordedAt
    ),
    index("idx_usage_logs_cursor").on(table.tenantId, table.createdAt, table.id),
  ]
);

export type AssetUsageLog = typeof assetUsageLogs.$inferSelect;
export type NewAssetUsageLog = typeof assetUsageLogs.$inferInsert;

// 3. Maintenance Plans
export const maintenancePlans = pgTable(
  "maintenance_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    assetId: uuid("asset_id").references(() => assets.id, {
      onDelete: "cascade",
    }),
    assetType: assetTypeEnum("asset_type"),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    metricType: assetUsageMetricTypeEnum("metric_type").notNull(),
    intervalValue: numeric("interval_value", { precision: 14, scale: 2 }),
    intervalDays: integer("interval_days"),
    baselineUsage: numeric("baseline_usage", { precision: 14, scale: 2 }),
    baselineDate: timestamp("baseline_date", { withTimezone: true }),
    alertThresholdPercentage: integer("alert_threshold_percentage")
      .default(90)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_maint_plans_tenant").on(table.tenantId, table.assetType),
  ]
);

export type MaintenancePlan = typeof maintenancePlans.$inferSelect;
export type NewMaintenancePlan = typeof maintenancePlans.$inferInsert;

// 4. Maintenance Orders
export const maintenanceOrders = pgTable(
  "maintenance_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    assetId: uuid("asset_id")
      .references(() => assets.id, { onDelete: "cascade" })
      .notNull(),
    planId: uuid("plan_id").references(() => maintenancePlans.id, {
      onDelete: "set null",
    }),
    orderType: maintenanceOrderTypeEnum("order_type").notNull(),
    status: maintenanceOrderStatusEnum("status").default("SCHEDULED").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    cost: numeric("cost", { precision: 14, scale: 2 }).default("0.00").notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    providerName: varchar("provider_name", { length: 255 }),
    invoiceNumber: varchar("invoice_number", { length: 100 }),
    paymentTerms: maintenancePaymentTermsEnum("payment_terms")
      .default("IMMEDIATE")
      .notNull(),
    serviceDate: date("service_date").defaultNow().notNull(),
    dueDate: date("due_date"),
    usageAtService: numeric("usage_at_service", { precision: 14, scale: 2 }),
    dueUsage: numeric("due_usage", { precision: 14, scale: 2 }),
    partsReplaced: jsonb("parts_replaced")
      .$type<PartReplaced[]>()
      .default([])
      .notNull(),
    financialTransactionId: uuid("financial_transaction_id").references(
      () => financialTransactions.id,
      { onDelete: "set null" }
    ),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_maint_orders_asset_status").on(
      table.tenantId,
      table.assetId,
      table.status
    ),
    index("idx_maint_orders_cursor").on(
      table.tenantId,
      table.createdAt,
      table.id
    ),
  ]
);

export type MaintenanceOrder = typeof maintenanceOrders.$inferSelect;
export type NewMaintenanceOrder = typeof maintenanceOrders.$inferInsert;

// Assets Zod Schemas
export const insertAssetSchema = createInsertSchema(assets, {
  name: z.string().min(1, "Name is required"),
  type: z.enum(assetTypeValues),
  status: z.enum(assetStatusValues).default("OPERATIONAL"),
  customFields: z.record(z.unknown()).default({}),
});
export const selectAssetSchema = createSelectSchema(assets);

export const insertAssetUsageLogSchema = createInsertSchema(assetUsageLogs, {
  metricType: z.enum(assetUsageMetricTypeValues),
  value: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0;
  }, { message: "Value must be a non-negative number" }),
});
export const selectAssetUsageLogSchema = createSelectSchema(assetUsageLogs);

export const insertMaintenancePlanSchema = createInsertSchema(maintenancePlans, {
  name: z.string().min(1, "Plan name is required"),
  metricType: z.enum(assetUsageMetricTypeValues),
  alertThresholdPercentage: z.number().int().min(1).max(100).default(90),
  isActive: z.boolean().default(true),
  baselineUsage: z.string().nullable().optional(),
  baselineDate: z.date().nullable().optional(),
});
export const selectMaintenancePlanSchema = createSelectSchema(maintenancePlans, {
  baselineUsage: z.string().nullable(),
  baselineDate: z.date().nullable(),
});

export const insertMaintenanceOrderSchema = createInsertSchema(maintenanceOrders, {
  title: z.string().min(1, "Title is required"),
  orderType: z.enum(maintenanceOrderTypeValues),
  status: z.enum(maintenanceOrderStatusValues).default("SCHEDULED"),
  cost: z.string().default("0.00"),
  currency: z.string().length(3).default("USD"),
  paymentTerms: z.enum(maintenancePaymentTermsValues).default("IMMEDIATE"),
});
export const selectMaintenanceOrderSchema = createSelectSchema(maintenanceOrders);
