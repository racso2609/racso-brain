import { describe, it, expect } from "vitest";
import {
  users,
  tenants,
  tenantMemberships,
  roles,
  permissions,
  rolePermissions,
  auditLogs,
  financialTransactions,
  financialTxTypeValues,
  financialTxStatusValues,
  insertFinancialTransactionSchema,
  insertTenantSchema,
  insertUserSchema,
} from "@/db/schema";

describe("Database Schemas & Validation Constraints", () => {
  it("exports all required core table definitions", () => {
    expect(users).toBeDefined();
    expect(tenants).toBeDefined();
    expect(tenantMemberships).toBeDefined();
    expect(roles).toBeDefined();
    expect(permissions).toBeDefined();
    expect(rolePermissions).toBeDefined();
    expect(auditLogs).toBeDefined();
    expect(financialTransactions).toBeDefined();
  });

  it("contains the correct financial enum values according to SDD and ADR-001", () => {
    expect(financialTxTypeValues).toEqual(["INCOME", "EXPENSE", "RECEIVABLE", "PAYABLE"]);
    expect(financialTxStatusValues).toEqual([
      "COMMITTED",
      "PENDING_PAYMENT",
      "SETTLED",
      "VOIDED",
    ]);
  });

  it("validates financial transaction insertion with strict positive amount", () => {
    const validData = {
      tenantId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      txType: "INCOME" as const,
      status: "COMMITTED" as const,
      amount: "1500.50",
      currency: "USD",
      originModule: "PROJECT_HUB",
      category: "CONSULTING",
      description: "Pago de hito 1",
    };

    const parsed = insertFinancialTransactionSchema.parse(validData);
    expect(parsed.amount).toBe("1500.50");
    expect(parsed.txType).toBe("INCOME");

    // Amount <= 0 must fail
    expect(() =>
      insertFinancialTransactionSchema.parse({
        ...validData,
        amount: "0",
      })
    ).toThrow();

    expect(() =>
      insertFinancialTransactionSchema.parse({
        ...validData,
        amount: "-100.00",
      })
    ).toThrow();

    // Invalid enum must fail
    expect(() =>
      insertFinancialTransactionSchema.parse({
        ...validData,
        txType: "INVALID_TYPE",
      })
    ).toThrow();
  });

  it("validates tenant and user schemas correctly", () => {
    const validTenant = {
      name: "Acme Corp",
      slug: "acme-corp",
    };
    expect(insertTenantSchema.parse(validTenant).name).toBe("Acme Corp");

    const validUser = {
      id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      email: "test@example.com",
      fullName: "Test User",
    };
    expect(insertUserSchema.parse(validUser).email).toBe("test@example.com");

    expect(() =>
      insertUserSchema.parse({
        ...validUser,
        email: "not-an-email",
      })
    ).toThrow();
  });
});
