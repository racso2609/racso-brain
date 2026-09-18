ALTER TABLE "maintenance_plans" ADD COLUMN "baseline_usage" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "maintenance_plans" ADD COLUMN "baseline_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "maintenance_orders" ADD COLUMN "due_usage" numeric(14, 2);
