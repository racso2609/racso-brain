import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  numeric,
  date,
  timestamp,
  text,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenancy";
import { users } from "./auth";

export const financialTxTypeValues = ["INCOME", "EXPENSE", "RECEIVABLE", "PAYABLE"] as const;
export type FinancialTxType = (typeof financialTxTypeValues)[number];

export const financialTxStatusValues = [
  "COMMITTED",
  "PENDING_PAYMENT",
  "SETTLED",
  "VOIDED",
] as const;
export type FinancialTxStatus = (typeof financialTxStatusValues)[number];

export const financialTxTypeEnum = pgEnum("financial_tx_type", financialTxTypeValues);
export const financialTxStatusEnum = pgEnum("financial_tx_status", financialTxStatusValues);

export const financialTransactions = pgTable(
  "financial_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id, { onDelete: "restrict" })
      .notNull(),
    txType: financialTxTypeEnum("tx_type").notNull(),
    status: financialTxStatusEnum("status").default("COMMITTED").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).default("USD").notNull(),
    issueDate: date("issue_date").defaultNow().notNull(),
    dueDate: date("due_date"),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    originModule: varchar("origin_module", { length: 64 }).notNull(),
    originId: uuid("origin_id"),
    category: varchar("category", { length: 100 }).notNull(),
    description: text("description").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_fin_tx_tenant_module").on(table.tenantId, table.originModule, table.originId),
    index("idx_fin_tx_tenant_status").on(table.tenantId, table.status),
    index("idx_fin_tx_issue_date").on(table.tenantId, table.issueDate),
    index("idx_fin_tx_cursor").on(table.tenantId, table.createdAt, table.id),
  ]
);

export type FinancialTransaction = typeof financialTransactions.$inferSelect;
export type NewFinancialTransaction = typeof financialTransactions.$inferInsert;
