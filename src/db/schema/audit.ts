import { pgTable, uuid, varchar, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";
import { users } from "./auth";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 100 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    oldData: jsonb("old_data").$type<Record<string, unknown> | null>(),
    newData: jsonb("new_data").$type<Record<string, unknown> | null>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_logs_tenant").on(table.tenantId, table.createdAt),
    index("idx_audit_logs_entity").on(table.tenantId, table.entityType, table.entityId),
  ]
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
