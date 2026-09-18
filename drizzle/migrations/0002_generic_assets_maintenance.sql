-- =================================================================
-- 1. Create Enums for Generic Assets & Maintenance Engine
-- =================================================================
CREATE TYPE "public"."asset_type" AS ENUM('VEHICLE', 'HVAC', 'HEAVY_MACHINERY', 'EQUIPMENT', 'FACILITY');--> statement-breakpoint
CREATE TYPE "public"."asset_status" AS ENUM('OPERATIONAL', 'UNDER_MAINTENANCE', 'DECOMMISSIONED');--> statement-breakpoint
CREATE TYPE "public"."asset_usage_metric_type" AS ENUM('ODOMETER_KM', 'HOURS_OPERATED', 'CYCLES', 'CALENDAR_DAYS');--> statement-breakpoint
CREATE TYPE "public"."maintenance_order_type" AS ENUM('PREVENTIVE', 'CORRECTIVE');--> statement-breakpoint
CREATE TYPE "public"."maintenance_order_status" AS ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."maintenance_payment_terms" AS ENUM('IMMEDIATE', 'CREDIT_15_DAYS', 'CREDIT_30_DAYS', 'CREDIT_60_DAYS');--> statement-breakpoint

-- =================================================================
-- 2. Create Tables
-- =================================================================
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "asset_type" NOT NULL,
	"status" "asset_status" DEFAULT 'OPERATIONAL' NOT NULL,
	"serial_number" varchar(255),
	"custom_fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "asset_usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"metric_type" "asset_usage_metric_type" NOT NULL,
	"value" numeric(14, 2) NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "maintenance_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid,
	"asset_type" "asset_type",
	"name" varchar(255) NOT NULL,
	"description" text,
	"metric_type" "asset_usage_metric_type" NOT NULL,
	"interval_value" numeric(14, 2),
	"interval_days" integer,
	"alert_threshold_percentage" integer DEFAULT 90 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "maintenance_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"plan_id" uuid,
	"order_type" "maintenance_order_type" NOT NULL,
	"status" "maintenance_order_status" DEFAULT 'SCHEDULED' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"cost" numeric(14, 2) DEFAULT '0.00' NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"provider_name" varchar(255),
	"invoice_number" varchar(100),
	"payment_terms" "maintenance_payment_terms" DEFAULT 'IMMEDIATE' NOT NULL,
	"service_date" date DEFAULT now() NOT NULL,
	"due_date" date,
	"usage_at_service" numeric(14, 2),
	"parts_replaced" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"financial_transaction_id" uuid,
	"created_by" uuid,
	"completed_at" timestamp with time zone,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Rename createdAt/updatedAt columns in maintenance_orders if needed to created_at/updated_at
ALTER TABLE "maintenance_orders" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "maintenance_orders" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint

-- Foreign Keys
ALTER TABLE "assets" ADD CONSTRAINT "assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "asset_usage_logs" ADD CONSTRAINT "asset_usage_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_usage_logs" ADD CONSTRAINT "asset_usage_logs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_usage_logs" ADD CONSTRAINT "asset_usage_logs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD CONSTRAINT "maintenance_plans_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_plan_id_maintenance_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."maintenance_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_financial_transaction_id_financial_transactions_id_fk" FOREIGN KEY ("financial_transaction_id") REFERENCES "public"."financial_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD CONSTRAINT "maintenance_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Indexes
CREATE INDEX "idx_assets_tenant_type" ON "assets" USING btree ("tenant_id","type");--> statement-breakpoint
CREATE INDEX "idx_assets_tenant_status" ON "assets" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "idx_assets_cursor" ON "assets" USING btree ("tenant_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_assets_custom_fields" ON "assets" USING gin ("custom_fields");--> statement-breakpoint

CREATE INDEX "idx_usage_logs_asset_metric" ON "asset_usage_logs" USING btree ("tenant_id","asset_id","metric_type","recorded_at");--> statement-breakpoint
CREATE INDEX "idx_usage_logs_cursor" ON "asset_usage_logs" USING btree ("tenant_id","created_at","id");--> statement-breakpoint

CREATE INDEX "idx_maint_plans_tenant" ON "maintenance_plans" USING btree ("tenant_id","asset_type");--> statement-breakpoint

CREATE INDEX "idx_maint_orders_asset_status" ON "maintenance_orders" USING btree ("tenant_id","asset_id","status");--> statement-breakpoint
CREATE INDEX "idx_maint_orders_cursor" ON "maintenance_orders" USING btree ("tenant_id","created_at","id");--> statement-breakpoint

-- =================================================================
-- 3. Enable Row Level Security (RLS) & Multi-Tenant Isolation
-- =================================================================
ALTER TABLE "public"."assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."asset_usage_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."maintenance_plans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."maintenance_orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY "assets_tenant_isolation" ON "public"."assets"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );--> statement-breakpoint

CREATE POLICY "asset_usage_logs_tenant_isolation" ON "public"."asset_usage_logs"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );--> statement-breakpoint

CREATE POLICY "maintenance_plans_tenant_isolation" ON "public"."maintenance_plans"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );--> statement-breakpoint

CREATE POLICY "maintenance_orders_tenant_isolation" ON "public"."maintenance_orders"
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tm.tenant_id
      FROM "public"."tenant_memberships" tm
      WHERE tm.user_id = auth.uid()
    )
  );
