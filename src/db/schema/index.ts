import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { users } from "./auth";
import { tenants, tenantMemberships } from "./tenancy";
import { roles, permissions, rolePermissions } from "./roles";
import { auditLogs } from "./audit";
import {
  financialTransactions,
  financialTxTypeEnum,
  financialTxStatusEnum,
  financialTxTypeValues,
  financialTxStatusValues,
} from "./ledger";
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
} from "./assets";

export * from "./auth";
export * from "./tenancy";
export * from "./roles";
export * from "./audit";
export * from "./ledger";
export * from "./assets";

// Zod Schemas
export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email(),
  fullName: z.string().min(1),
});

export const selectUserSchema = createSelectSchema(users);

export const insertTenantSchema = createInsertSchema(tenants, {
  name: z.string().min(1),
  slug: z.string().min(1).max(64),
});

export const selectTenantSchema = createSelectSchema(tenants);

export const insertTenantMembershipSchema = createInsertSchema(tenantMemberships);
export const selectTenantMembershipSchema = createSelectSchema(tenantMemberships);

export const insertRoleSchema = createInsertSchema(roles);
export const selectRoleSchema = createSelectSchema(roles);

export const insertPermissionSchema = createInsertSchema(permissions);
export const selectPermissionSchema = createSelectSchema(permissions);

export const insertAuditLogSchema = createInsertSchema(auditLogs);
export const selectAuditLogSchema = createSelectSchema(auditLogs);

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions, {
  amount: z
    .string()
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: "Amount must be greater than 0" }),
  txType: z.enum(financialTxTypeValues),
  status: z.enum(financialTxStatusValues).default("COMMITTED"),
  currency: z.string().length(3).default("USD"),
  originModule: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
});

export const selectFinancialTransactionSchema = createSelectSchema(financialTransactions);

